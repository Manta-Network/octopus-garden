
export const randomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
};

export const range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
