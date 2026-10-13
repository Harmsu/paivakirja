-- Paikka- ja kuvapäiväkirja: yksi entry per päivä, lapsina tekstit, kuvat ja paikat.
-- Huom: DATE-sarake palautetaan pg:ltä merkkijonona (ks. src/db.js), ei Date-oliona.

CREATE TABLE entries (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE text_blocks (
  id SERIAL PRIMARY KEY,
  entry_id INT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INT NOT NULL
);
CREATE INDEX text_blocks_entry_idx ON text_blocks (entry_id);

-- object_key / thumb_key: avaimet Object Storagessa (ei URL:ia, URL:t allekirjoitetaan lennossa)
CREATE TABLE photos (
  id SERIAL PRIMARY KEY,
  entry_id INT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  thumb_key TEXT NOT NULL,
  caption TEXT,
  width INT,
  height INT,
  sort_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photos_entry_idx ON photos (entry_id);

CREATE TABLE checkins (
  id SERIAL PRIMARY KEY,
  entry_id INT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  place_name TEXT NOT NULL,
  category TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  sort_order INT NOT NULL,
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE INDEX checkins_entry_idx ON checkins (entry_id);
