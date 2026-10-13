-- Suosikkipaikat. Checkin kopioi suosikin tiedot itselleen, eikä checkins-taulussa ole
-- viittausta tänne: suosikin muokkaus tai poisto ei muuta vanhoja kirjauksia.
CREATE TABLE favorite_places (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  use_count INT NOT NULL DEFAULT 0,
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
-- Sama nimi vain kerran (kirjainkoosta riippumatta)
CREATE UNIQUE INDEX favorite_places_name_idx ON favorite_places (lower(name));
