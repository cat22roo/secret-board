'use strict';
const postsHandler = require('./posts-handler');
const util = require('./handler-util'); // handleNotFound関数を呼び出す為

function route(req, res) {
  // 本番環境でHTTPアクセスされたら404にする
  if (process.env.DATABASE_URL
    && req.headers['x-forwarded-proto'] === 'http') {
    util.handleNotFound(req, res);
    return;
  }
  switch (req.url) {
    case '/posts': // 投稿系の処理
      postsHandler.handle(req, res);
      break;
    case '/posts?delete=1':
      postsHandler.handleDelete(req, res);
      break;    
    case '/logout': // ログアウト処理
      util.handleLogout(req, res);
      break;
    case '/favicon.ico':
      util.handleFavicon(req, res);
      break;  
    default: // その他の処理
      util.handleNotFound(req, res);
      break;
  }
}

module.exports = {
  route
};