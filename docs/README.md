# Formbricks Documentation

This documentation is built using Mintlify. Here's how to run it locally and contribute.

## Local Development

1. Install the [Mintlify CLI](https://www.npmjs.com/package/mintlify):

```bash
npm i -g mintlify
```

2. Clone the Formbricks repository and navigate to the docs folder:

```bash
git clone https://github.com/formbricks/formbricks.git
cd formbricks/docs
```

3. Run the documentation locally:

```bash
mintlify dev
```

The documentation will be available at `http://localhost:3000`.

### Contributing

1. Create a new branch for your changes
2. Make your documentation updates
3. Submit a pull request to the main repository

### Troubleshooting

- If Mintlify dev isn't running, try `mintlify install` to reinstall dependencies
- If a page loads as a 404, ensure you're in the `docs` folder with the `mint.json` file
- For other issues, please check our [Contributing Guidelines](https://github.com/formbricks/formbricks/blob/main/CONTRIBUTING.md)
