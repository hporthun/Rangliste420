import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      /** Primary login identifier shown in the UI */
      username: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    username?: string;
  }
}
