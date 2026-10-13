// Kuvien pienennys ennen tallennusta (sama malli kuin HIFF:n lippukuvissa):
// EXIF-kierto, pitkä sivu max 1600 px, JPEG 80 %, lisäksi 400 px pienoiskuva.
// Alkuperäistä ei tallenneta. EXIF-metatiedot (mm. GPS) poistuvat.
import sharp from 'sharp';
import multer from 'multer';

sharp.cache(false);
sharp.concurrency(1); // Renderin pieni muisti

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) return cb(new Error('Vain JPEG-, PNG- tai WebP-kuvat sallittu'));
    cb(null, true);
  },
});

export function uploadSingle(req, res, next) {
  upload.single('file')(req, res, err => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Kuva on liian suuri (max 25 Mt)' : err.message;
      return res.status(400).json({ error: msg || 'Tiedoston lataus epäonnistui' });
    }
    next();
  });
}

export async function processImage(buffer) {
  const base = sharp(buffer, { failOn: 'none' }).rotate();
  const main = await base.clone()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base.clone()
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
  return { main: main.data, width: main.info.width, height: main.info.height, thumb };
}
