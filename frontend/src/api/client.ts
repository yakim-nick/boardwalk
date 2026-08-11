import { Board, BoardWithColumns, Task } from '../types';

const TOKEN_KEY = 'flowboard.token';

/** Reads the stored JWT, or null when not logged in. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Persists the JWT after login/registration. */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Removes the stored JWT on logout or when it is rejected by the server. */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Error thrown for any failed API call, carrying the HTTP status and code. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Successful response envelope: `{ data: T }`. */
interface ApiResponse<T> {
  data: T;
  error?: never;
}

/** Error response envelope: `{ error: { code, message } }`. */
interface ApiErrorBody {
  data?: never;
  error: { code: string; message: string };
}

/**
 * Performs an authenticated JSON request against the API.
 * Attaches the stored JWT, unwraps the `data` envelope, and converts any
 * failure (network or HTTP) into an `ApiError`.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | ApiErrorBody | null;

  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(res.status, err?.error.code ?? 'UNKNOWN', err?.error.message ?? 'Request failed');
  }

  return (body as ApiResponse<T>).data;
}

/** Typed client for every backend endpoint. */
export const api = {
  /** POST /auth/register — creates an account. */
  register(input: { name: string; email: string; password: string }) {
    return request<{ token: string; user: import('../types').User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** POST /auth/login — exchanges credentials for a token. */
  login(input: { email: string; password: string }) {
    return request<{ token: string; user: import('../types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** GET /auth/me — returns the currently authenticated user. */
  me() {
    return request<{ user: import('../types').User }>('/auth/me');
  },

  /** GET /boards — lists the current user's boards. */
  listBoards() {
    return request<{ boards: Board[] }>('/boards');
  },

  /** POST /boards — creates a board with default columns. */
  createBoard(name: string) {
    return request<{ board: Board }>('/boards', { method: 'POST', body: JSON.stringify({ name }) });
  },

  /** GET /boards/:id — loads a board with columns and tasks. */
  getBoard(id: string) {
    return request<{ board: BoardWithColumns }>(`/boards/${id}`);
  },

  /** POST /boards/:boardId/columns — appends a column. */
  addColumn(boardId: string, title: string) {
    return request<{ board: BoardWithColumns }>(`/boards/${boardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  /** POST /boards/:boardId/tasks — creates a task in a column. */
  createTask(boardId: string, input: { title: string; description?: string; columnId: string }) {
    return request<{ task: Task }>(`/boards/${boardId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** PATCH /boards/:boardId/tasks/:taskId — partially updates a task. */
  updateTask(
    boardId: string,
    taskId: string,
    input: { title?: string; description?: string | null; order?: number; columnId?: string }
  ) {
    return request<{ task: Task }>(`/boards/${boardId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  /** DELETE /boards/:boardId/tasks/:taskId — deletes a task. */
  deleteTask(boardId: string, taskId: string) {
    return request<void>(`/boards/${boardId}/tasks/${taskId}`, { method: 'DELETE' });
  },
};