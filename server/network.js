function interfacePriority(name) {
  if (/^(wi-?fi|wireless|wlan)/i.test(name)) return 0;
  if (/^(ethernet|eth\d*|en\d+)/i.test(name)) return 1;
  if (/(virtual|vmware|hyper-v|vEthernet|virtualbox|loopback|tunnel)/i.test(name)) return 3;
  return 2;
}

export function getLanAddresses(networkInterfaces) {
  return Object.entries(networkInterfaces)
    .flatMap(([name, interfaces]) => (interfaces || [])
      .filter((network) => (
        !network.internal &&
        (network.family === 'IPv4' || network.family === 4) &&
        !network.address.startsWith('169.254.')
      ))
      .map((network) => ({ address: network.address, priority: interfacePriority(name) })))
    .sort((first, second) => first.priority - second.priority)
    .map(({ address }) => address);
}
