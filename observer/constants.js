export const temujin = {
  scheme: 'mongodb',
  host: 'alpha.temujin.pelagos.systems:27017,beta.temujin.pelagos.systems:27017,gamma.temujin.pelagos.systems:27017',
  auth: {
    mechanism: 'MONGODB-X509',
    source: '$external',
  },
  tls: 'true',
  cert: '/etc/ssl/key+chain.pem',
  ca: '/etc/ssl/ca.pem',
};
