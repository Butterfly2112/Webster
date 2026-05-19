export interface User {
  id: number;
  login: string;
  username: string;
  email: string;
  avatar_url: string;
  created_at: string;
}

export interface LoginResponseDto {
  access_token: string;
  user: User;
}

export interface Font {
  id: number;
  name: string;
  url: string;
  format: string;
  owner_id: number | null;
}
