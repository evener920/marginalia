// Marginalia · Decap CMS OAuth 代理（GitHub 后端，免官方代理）
// 流程：
//   1) 浏览器访问 /  → 302 到 GitHub 授权页（scope=repo）
//   2) GitHub 回调 /callback?code=...  → 用 client_secret 换 access_token
//   3) 302 回 admin/#access_token=TOKEN  → Decap 完成登录
//
// 环境变量（非机密）：
//   ADMIN_URL    —— Decap 后台地址，回跳用
//   GITHUB_CLIENT_ID  —— 来自 GitHub OAuth App（也可 wrangler secret put）
// 机密（务必 wrangler secret put）：
//   GITHUB_CLIENT_SECRET

const GITHUB_AUTH = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminUrl = (env.ADMIN_URL || "https://marginalia.201573.xyz/admin/").replace(/\/?$/, "/");

    // —— 2) GitHub 回调：用 code 换 token，再回跳 admin ——
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing ?code from GitHub", { status: 400 });
      }
      const resp = await fetch(GITHUB_TOKEN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const data = await resp.json();
      const token = data.access_token;
      if (!token) {
        return new Response(
          "GitHub 未返回 access_token：" + JSON.stringify(data),
          { status: 400 }
        );
      }
      // Decap 从 location.hash 读取 token
      return Response.redirect(adminUrl + "#access_token=" + token, 302);
    }

    // —— 1) 默认入口：发起 GitHub OAuth 授权 ——
    if (!env.GITHUB_CLIENT_ID) {
      return new Response("Worker 未配置 GITHUB_CLIENT_ID（请 wrangler secret put）", {
        status: 500,
      });
    }
    const redirectUri = url.origin + "/callback";
    const authUrl = new URL(GITHUB_AUTH);
    authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "repo");
    return Response.redirect(authUrl.toString(), 302);
  },
};
