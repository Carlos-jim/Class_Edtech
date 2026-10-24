export interface Student {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

export interface LoginResponse {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresAt: string;
  readonly student: Student;
}

export interface Session {
  readonly token: string;
  readonly expiresAt: number;
  readonly student: Student;
}
