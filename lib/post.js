'use strict';
const { Sequelize, DataTypes } = require('sequelize');

const dialectOptions = {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};

// DBの全体の設定
const sequelize = process.env.DATABASE_URL ?
  // 本番環境
  new Sequelize(
    process.env.DATABASE_URL,
    {
      logging: false,
      dialectOptions
    }
  )
  :
  // 開発環境
  new Sequelize(
    // DBにログインするための設定
    'postgres://postgres:postgres@db/secret_board',
    {
      logging: false  // 起動ログなど様々なログをオフにする設定
    }
  );
// 投稿データのデータモデル定義
const Post = sequelize.define(
  'Post',
  {
    id: { // データのID
      type: DataTypes.INTEGER, // 数値型
      autoIncrement: true, // 1から順に自動採番する設定
      primaryKey: true // 検索に使うための設定(検索が速くなる)
    },
    content: { // 投稿されたメッセージの本文
      type: DataTypes.TEXT // 長い文字列の型
    },
    postedBy: { // 投稿者
      type: DataTypes.STRING // 短い文字列の型
    },
    trackingCookie: { // 投稿者追跡情報
      type: DataTypes.STRING // 短い文字列の型
    }
  },
  {  // その他の設定
    freezeTableName: true, // テーブル名を固定する
    timestamps: true // 投稿日、更新日を記録する設定
  }
);

Post.sync(); // このファイルの初回起動時にDBの設定を同期する
module.exports = Post; // 別ファイルからアクセスできるようにする