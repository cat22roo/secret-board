'use strict';
const length = 12; // 作るパスワードの長さ
// パスワード生成に使う文字の種類
const charset =
'abcdefghijklmnopqrstuvwxyz' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789';

function passwordGenerator(){
  // 今から作るパスワードの入れ物
  let password = '';
  // パスワードの長さ分ループ
  for (let i = 0; i < length; i++) {
    // ランダムな1文字を入れる
    const index = Math.floor(Math.random() * charset.length)
    password += charset[index];
  }
  // 要件チェック
  // 要件：英小文字と英大文字、数字の3種類を含む
  const includeAllTypes =
  /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
  //　要件を満たしていれば完成、そうでなければもう一回(再帰)
  return includeAllTypes ? password : passwordGenerator();
}

console.log(passwordGenerator());