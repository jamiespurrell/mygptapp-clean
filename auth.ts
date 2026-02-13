import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { db } from './lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database' },
  pages: {
    signIn: '/sign-in',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.toLowerCase().trim() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';

        if (!email || !password) {
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) {
          return null;
        }

        const passwordMatches = await compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
});
