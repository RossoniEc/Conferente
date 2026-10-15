-- Registros sincronizados do CargaCheck: um documento JSON por item de cada coleção
CREATE TABLE IF NOT EXISTS registros (
  colecao TEXT NOT NULL,
  id TEXT NOT NULL,
  dados TEXT,
  excluido INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  atualizado_em TEXT NOT NULL,
  atualizado_por TEXT,
  PRIMARY KEY (colecao, id)
);

CREATE INDEX IF NOT EXISTS idx_registros_seq ON registros (seq);
