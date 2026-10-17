import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";

/**
 * セッションの有効期限（秒）。
 * Auth.js の既定値は 30 日だが、既定値へ依存すると将来のバージョンアップで
 * 黙って変わり得るため、契約としてここに固定する。
 */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 日

/**
 * 未認証の API アクセスに返すヘッダー。
 * 既存 Route Handler（src/app/api 配下）の SECURITY_HEADERS と揃える。
 */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, no-cache",
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  // OAuth プロバイダの指定。
  // AUTH_GOOGLE_ID と AUTH_GOOGLE_SECRET が環境変数にあれば自動ロードされる
  providers: [Google],

  // データベース（Adapter）を使用しないため、JWT ベースのセッション管理を明示。
  // これによりエッジランタイム（Middleware 等）でも軽量・高速に動作する
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },

  // 未認証ユーザーのリダイレクト先（signIn）と、認証エラー時の表示先（error）。
  // どちらも "/login" 配下に置くことで、Middleware の matcher 除外に自動的に含まれる
  pages: { signIn: "/login", error: "/login/error" },

  callbacks: {
    // ページにアクセスしてきたユーザーのセッション（auth）を受け取り、
    // アクセスを「許可する (true)」か「拒否する (false / Response)」かを返す
    authorized({ request, auth }) {
      const isLoggedIn = !!auth?.user;

      // API はリダイレクトせず 401 JSON を返す。
      // /login の HTML へリダイレクトするとブラウザが追従して 200 を受け取り、
      // クライアント側の res.json() が構文エラーで落ちる。
      // 結果セッション切れが「検索が壊れた」ようにしか見えなくなるため、
      // 機械可読なステータスで返して呼び出し側が判定できるようにする
      if (request.nextUrl.pathname.startsWith("/api/")) {
        if (isLoggedIn) return true;
        return NextResponse.json(
          { error: "認証が必要です" },
          { status: 401, headers: SECURITY_HEADERS },
        );
      }

      // ページは従来どおり pages.signIn（/login）へリダイレクトさせる
      return isLoggedIn;
    },
  },
});
