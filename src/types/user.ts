export type AccountRole = "user" | "admin";

export type UserResponse = {
  id: string;
  username: string;
  email: string;
  roles: string[];
  created_at: string;
};

export type CreateUserRequest = {
  username: string;
  email: string;
  password?: string;
  roles: AccountRole[];
};

export type UpdateUserRequest = {
  username: string;
  email: string;
  roles: AccountRole[];
};