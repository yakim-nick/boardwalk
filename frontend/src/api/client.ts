import { Board, BoardWithColumns, Task } from '../types';

const TOKEN_KEY = 'flowboard.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

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

interface ApiResponse<T> {
  data: T;
  error?: never;
}

interface ApiErrorBody {
  data?: never;
  error: { code: string; message: string };
}

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

export const api = {
  register(input: { name: string; email: string; password: string }) {
    return request<{ token: string; user: import('../types').User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }) {
    return request<{ token: string; user: import('../types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  me() {
    return request<{ user: import('../types').User }>('/auth/me');
  },

  listBoards() {
    return request<{ boards: Board[] }>('/boards');
  },

  createBoard(name: string) {
    return request<{ board: Board }>('/boards', { method: 'POST', body: JSON.stringify({ name }) });
  },

  getBoard(id: string) {
    return request<{ board: BoardWithColumns }>(`/boards/${id}`);
  },

  addColumn(boardId: string, title: string) {
    return request<{ board: BoardWithColumns }>(`/boards/${boardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  createTask(boardId: string, input: { title: string; description?: string; columnId: string }) {
    return request<{ task: Task }>(`/boards/${boardId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

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

  deleteTask(boardId: string, taskId: string) {
    return request<void>(`/boards/${boardId}/tasks/${taskId}`, { method: 'DELETE' });
  },
};
