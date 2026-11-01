import argon2 from 'argon2';

const options = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

export const hashPassword = (password) => argon2.hash(password, options);
