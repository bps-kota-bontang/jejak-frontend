export type LoginSSORequest = {
  token: string;
  state: string;
};

export type AccessTokenResponse = {
  access_token: string;
};