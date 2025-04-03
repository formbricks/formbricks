const formatAddress = (address: string, slice = 5) => {
    return address.slice(0, slice) + ".." + address.slice(-slice);
}

export { formatAddress };