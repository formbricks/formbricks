# Formbricks Documentation

This documentation is built using Mintlify. Here's how to run it locally and contribute.

## Local Development

1. Install the [Mintlify CLI](https://www.npmjs.com/package/mint):

```bash
npm i -g mint
```

2. Clone the Formbricks repository and navigate to the docs folder:

```bash
git clone https://github.com/formbricks/formbricks.git
cd formbricks/docs
```

3. Run the documentation locally:

```bash
mint dev
```

The documentation will be available at `http://localhost:3000`.

### Contributing

1. Create a new branch for your changes
2. Make your documentation updates
3. Submit a pull request to the main repository

### Troubleshooting

- If `mint dev` isn't running, try `mint update` to get the latest version of the CLI. If both `mint` and the legacy `mintlify` package are installed, uninstall `mintlify`
- If a page loads as a 404, ensure you're in the `docs` folder with the `docs.json` file
- For other issues, please check our [Contributing Guidelines](https://github.com/formbricks/formbricks/blob/main/CONTRIBUTING.md)
