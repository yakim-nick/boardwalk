const WebSocket = require('ws');
const BASE = 'http://localhost:8080';

async function main() {
  const email = `smoke-${Date.now()}@example.com`;

  const register = await fetch(`${BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Tester', email, password: 'Password123' }),
  });
  const regBody = await register.json();
  if (register.status !== 201)
    throw new Error(`register failed: ${register.status} ${JSON.stringify(regBody)}`);
  const token = regBody.data.token;
  console.log('1. register        -> 201, token ok');

  const login = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123' }),
  });
  const loginBody = await login.json();
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  if (!loginBody.data || !loginBody.data.token) throw new Error('login returned no token');
  console.log('2. login           -> 200, token ok');

  const createBoard = await fetch(`${BASE}/api/v1/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Smoke Board' }),
  });
  const boardBody = await createBoard.json();
  if (createBoard.status !== 201)
    throw new Error(`create board failed: ${createBoard.status} ${JSON.stringify(boardBody)}`);
  const boardId = boardBody.data.board.id;

  const detail = await fetch(`${BASE}/api/v1/boards/${boardId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const detailBody = await detail.json();
  const columns = detailBody.data.board.columns;
  console.log(
    `3. create board    -> 201, id=${boardId.slice(0, 8)}…, ${columns.length} default columns`
  );

  const got = new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:8080/ws', ['flowboard', token]);
    const timer = setTimeout(() => reject(new Error('WS event timeout')), 10000);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'task.created') {
        clearTimeout(timer);
        ws.close();
        resolve(msg);
      }
    });
    ws.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', boardId }));
    });
  });

  const created = await fetch(`${BASE}/api/v1/boards/${boardId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'Realtime task', columnId: columns[0].id }),
  });
  const taskBody = await created.json();
  if (created.status !== 201)
    throw new Error(`create task failed: ${created.status} ${JSON.stringify(taskBody)}`);
  console.log('4. create task     -> 201');

  const wsEvent = await got;
  console.log(`5. websocket event -> task.created received, task=${wsEvent.data.task.title}`);

  const update = await fetch(`${BASE}/api/v1/boards/${boardId}/tasks/${taskBody.data.task.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ columnId: columns[1].id, order: 0 }),
  });
  const updateBody = await update.json();
  if (update.status !== 200 || updateBody.data.task.columnId !== columns[1].id) {
    throw new Error(`move task failed: ${update.status}`);
  }
  console.log('6. move task       -> 200, moved to "In Progress"');

  const del = await fetch(`${BASE}/api/v1/boards/${boardId}/tasks/${taskBody.data.task.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (del.status !== 204) throw new Error(`delete task failed: ${del.status}`);
  console.log('7. delete task     -> 204');

  const finalDetail = await fetch(`${BASE}/api/v1/boards/${boardId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const finalBody = await finalDetail.json();
  const taskCount = finalBody.data.board.columns.reduce((n, c) => n + c.tasks.length, 0);
  if (taskCount !== 0) throw new Error(`expected 0 tasks, got ${taskCount}`);
  console.log('8. verify          -> 0 tasks remain, board consistent');

  console.log('\nALL SMOKE TESTS PASSED');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('SMOKE FAILED:', e.message);
    process.exit(1);
  });
