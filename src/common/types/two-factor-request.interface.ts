export interface TwoFactorRequest extends Request {
  user: {
    sub: string;
    isTwoFactorAuthenticated: boolean;
    is2FA: boolean;
    iat: number;
    exp: number;
    partialToken: string;
  };
}
