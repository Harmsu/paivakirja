import bcrypt from 'bcryptjs';
const pw = process.argv[2];
if (!pw) {
  console.error('Käyttö: npm run hash-password -- "salasana"');
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 12));
