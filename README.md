<p align="center">
<a href="https://github.com/snoopForms/snoopforms">
    <img src="https://user-images.githubusercontent.com/72809645/172191504-808da997-025b-4b1f-90c0-b8ef658af2dd.svg" alt="Logo" width="500">
  </a>
  <h3 align="center">snoopForms</h3>

  <p align="center">
    The Open-Source Typeform Alternative
    <br />
    <a href="https://snoopforms.com/">Website</a>  |  <a href="https://discord.gg/3YFcABF2Ts">Join Discord community</a>
  </p>
</p>

<p align="center">
<a href="https://github.com/snoopForms/snoopforms/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPLv3-purple" alt="License"></a> <a href="https://discord.gg/3YFcABF2Ts"><img src="https://img.shields.io/badge/Discord-SnoopForms-%234A154B" alt="Join snoopForms Discord"></a>
</p>

<br/>

> :warning: **Note**: This repository is still in an early stage of development. We love the open source community and want to show what we are working on early. We will update this readme with more information once it is safe to use. Until then, feel free to share your thoughts, contact us, and contribute if you'd like.

<br/>

## About snoopForms

<img width="937" alt="screenshot-snoopForms" src="https://user-images.githubusercontent.com/675065/172094334-b5ca09d0-2058-42e3-9b05-75c79c098d06.svg">

Spin up forms in minutes. Pipe your data exactly where you need it. Maximize your results with juicy analytics.

### Features

- Work with the React Lib or use our No Code Builder to build exactly the forms you need.
- Pipe your data where you need it. Don’t wait for your form provider to finally build the integration you desperately need.
- Since you can self-host Snoop Forms, it’s 100% compliant with all privacy regulations.
- How users interact with your form can be as important as their input. Don’t miss anything with our best-in-class analytics.
- We aim for the best possible developer experience. Use what you like, build on top what you need. Everything is possible.

### Built With

- [Typescript](https://www.typescriptlang.org/)
- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Prisma](https://prisma.io/)

## Getting started

To get the project running locally on your machine you need to have the following development tools installed:

- Node.JS (we recommend v16)
- Yarn
- PostgreSQL

1. Clone the project:

```
git clone https://github.com/snoopForms/snoopforms.git && cd snoopforms
```

2. Install Node.JS packages:

```
yarn install
```

3. Create a `.env` file based on `.env.example` and change it according to your setup. Make sure the `DATABASE_URL` variable is set correctly according to your local database.

```
cp .env.example .env
```

4. Use the code editor of your choice to edit the .env file.

5. Make sure your PostgreSQL Database Server is running. Then let prisma set up the database for you:

```

npx prisma migrate dev

```

6. Start the development server:

```

yarn dev

```

**You can now access the app on [https://localhost:3000](https://localhost:3000)**

## Deployment

The easiest way to deploy snoopForms yourself on your own machine is using Docker. This requires Docker and docker-compose on your system to work.

Clone the repository:

```

git clone https://github.com/snoopForms/snoopforms.git && cd snoopforms

```

Create a `.env` file based on `.env.example` and change it according to your setup.

```

cp .env.example .env && nano .env

```

Start the docker-compose process to build and spin up the snoopForms container as well as the postgres database.

```

docker-compose up -d

```

You can now access the app on [https://localhost:3000](https://localhost:3000)

## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the branch (`git push origin feature/AmazingFeature`)
6. Open a pull request

## License

Distributed under the AGPLv3 License. See `LICENSE` for more information.
