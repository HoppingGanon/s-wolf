-- DB切り替え
\c swolfdb

-- テーブル作成
CREATE TABLE  swolfschema.test (
  id INTEGER,
  name VARCHAR(10),
  value VARCHAR(10),
  PRIMARY KEY (id)
);

-- 権限追加
GRANT ALL PRIVILEGES ON swolfschema.test TO backend;
