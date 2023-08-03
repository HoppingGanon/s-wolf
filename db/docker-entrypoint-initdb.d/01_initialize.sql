-- DB作成
CREATE DATABASE swolfdb; 

-- 作成したDBへ切り替え
\c swolfdb

-- スキーマ作成
CREATE SCHEMA swolfschema;

-- ロールの作成
CREATE ROLE backend WITH LOGIN PASSWORD 'kazuya';

-- 権限追加
GRANT ALL PRIVILEGES ON SCHEMA swolfschema TO backend;
