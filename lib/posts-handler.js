'use strict';
const crypto = require('crypto');
const pug = require('pug');
const Cookies = require('cookies');
const util = require('./handler-util');// handleBadRequest関数を呼び出す為
const Post = require('./post');
const secret = require('./secret');

// 日付用のライブラリ
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const trackingIdKey = 'tracking_id';
// ユーザーごとにCSRFトーウンを管理する
// キーをユーザー名、値をトークンとする連想配列
const oneTimeTokenMap = new Map();

function handle(req, res) {
  // クッキーを操作するためのオブジェクトを生成
  const cookies = new Cookies(req, res);
  // 新しいルールのトラッキングIDを使う
  const trackingId = addTrackingCookie(cookies, req.user);

  switch (req.method) {
    case 'GET': // 投稿一覧を表示
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'self'; script-src https://*; style-src https://*"
      });
      Post.findAll({ order: [['id', 'DESC']] }).then((posts) => { // postsでもOK()は省略可
        // pugに渡す前にDBを取得(データ取得が終わった後に実行される処理)
        // DBから取得してきたデータを1件1件ループする
        posts.forEach((post) => {
          // 投稿日時を見やすくフォーマット
          post.formattedCreatedAt = dayjs(post.createdAt).tz('Asia/Tokyo').format('YYYY年MM月DD日 HH時mm分ss秒');
        });
        // CSRFトークンを発行
        const oneTimeToken = crypto.randomBytes(8).toString('hex');
        // POSTが来たときに検証できるように保存しておく
        oneTimeTokenMap.set(req.user, oneTimeToken);
        res.end(pug.renderFile('./views/posts.pug', {
          posts,
          user: req.user,
          oneTimeToken
        }));

        console.info( // req.socket.remoteAddressはIPアドレス
          `閲覧されました: 
           user: ${req.user}, 
           trackingId: ${trackingId}, 
           remoteAddress: ${req.socket.remoteAddress}, 
           userAgent: ${req.headers['user-agent']}`
        );
      });
      break;
    case 'POST': // 投稿処理をして投稿一覧にリダイレクト
      // TODO POST(投稿)の処理
      let body = [];
      req.on('data', (chunck) => {
        body.push(chunck);
      }).on('end', () => {
        body = Buffer.concat(body).toString(); // body.join(' ');今回はバイナリデータだからできないかも
        const params = new URLSearchParams(body);
        const content = params.get('content');
        // パラメータからCSRFトークンを受け取る
        const requestedOneTimeToken = params.get('oneTimeToken');
        // 必要なパラメータが揃っているかチェック
        if (!(content && requestedOneTimeToken)) {
          // 必要なパラメータ無かったらはじく
          util.handleBadRequest(req, res);
          // CSRFトークンのチェック
        } else {
          if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken) {
            console.info(`投稿されました: ${content}`);
            // DBへの保存
            Post.create({
              content, // 投稿内容 content:content の略
              trackingCookie: trackingId, // 追跡情報
              postedBy: req.user // アクセスしてきたuser
            }).then(() => { //DBへの保存が終わったら実行する処理
              oneTimeTokenMap.delete(req.user);
              handleRedirectPosts(req, res); // 投稿一覧へのリダイレクト
            });
          } else {
            // CSRFトークンが不正な場合ははじく
            util.handleBadRequest(req, res);
          }
        }
      });
      break;
    default: // 処理未定義のメソッド
      util.handleBadRequest(req, res);
      break;
  }
}

/**
 * IDで指定された投稿データを削除
 * @param {Rwqest} req 
 * @param {Response} res 
 */
function handleDelete(req, res) {// 削除処理
  switch (req.method) {
    case 'POST': // formタグのメソッドがpostだから(pug参照)
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        const params = new URLSearchParams(body);
        const id = params.get('id'); // 削除対象のデータのID
        // パラメーターからCSRFトークンを受け取る
        const requestedOneTimeToken = params.get('oneTimeToken');

        //　必要なパラメーターがそろってなかったらはじく
        if (!(id && requestedOneTimeToken)) {
          util.handleBadRequest(req, res);
        } else {
          if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken) {
            // 削除対象のデータをDBから取得
            Post.findByPk(id).then((post) => {
              // 本当に消していいデータなのか確認する
              if (req.user === post.postedBy || req.user === 'admin') {
                // 取得した削除対象のデータをdestroy関数で削除
                post.destroy().then(() => { // データの削除
                  console.info(
                    `削除されました: 
                      user: ${req.user},
                      id: ${post.id},
                      remoteAddress: ${req.socket.remoteAddress},
                      userAget: ${'user-agent'} `
                  );
                  oneTimeTokenMap.delete(req.user);
                  // 投稿一覧画面を表示
                  handleRedirectPosts(req, res);
                });
              } else {
                util.handleBadRequest(req, res);
              }
            });
          }
        }
      });
      break;
    default:
      break;
  }
}

/**
 * Cookieに含まれているトラッキングIDに異常がなければその値を返し、
 * 存在しない場合や異常なものである場合には、再度作成しCookieに付与してその値を返す
 * @param {Cookies} cookies クッキー情報
 * @param {String} userName
 * @return {String} トラッキングID
*/

function addTrackingCookie(cookies, userName) {
  // クッキーに設定されているデータを取得
  const requestedTrackingId = cookies.get(trackingIdKey);
  //　設定されていたクッキーの検証結果が、trueならそのまま使い続ける
  if (isValidTrackingId(requestedTrackingId, userName)) {
    return requestedTrackingId;
  } else {
    // クッキーが設定されていないか、
    // または設定されていたクッキーの検証結果がfalseならクッキーを(再)発行する
    // トラッキングID(ランダムな値)を新しく作る
    const originalId = parseInt(crypto.randomBytes(8).toString('hex'), 16);
    // トラッキングIDの有効期限(24時間後)
    const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
    // クッキーにトラッキングIDを設定
    const trackingId = originalId + '_' + createValidHash(originalId, userName);
    cookies.set(trackingIdKey, trackingId, { expires: tomorrow });
    return trackingId;
  }
}

function isValidTrackingId(trackingId, userName) {
  if (!trackingId) { // 初回アクセスなのでクッキーの発行が必要
    return false;
  }
  // クッキーの正当性を検証
  const splitted = trackingId.split('_');
  const originalId = splitted[0]; // 元のトラッキングID
  const requestedHash = splitted[1]; // 検証用のハッシュ
  // 元のトラッキングIDとユーザー名のハッシュが
  // 検証用のハッシュと一致する場合はtrue
  return createValidHash(originalId, userName) === requestedHash;
}


function createValidHash(originalId, userName) {
  // cryptoモジュールの仕様に合わせてハッシュを作る
  const sha1sum = crypto.createHash('sha1');
  // 元のトラッキングIDとアクセスユーザーのIDでハッシュ化
  sha1sum.update(originalId + userName + secret.secretKey);
  return sha1sum.digest('hex');
}

/**
 *  投稿一覧へのリダイレクト
 *　@param {Request} req
 *  @param {Response} res
 * */
function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}
//　別のファイルで使えるようにする関数(変数)を書く
module.exports = {
  handle,
  handleDelete
};