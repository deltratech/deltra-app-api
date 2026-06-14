<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Local development with Docker (hot reload)

The default `docker compose up -d api` builds the **production** image, which bakes
the source into the image — so every code change forces a slow `--build`. For local
development use the `docker-compose.dev.yml` override instead: it runs the Dockerfile
`development` stage (`nest start --watch`) and bind-mounts your source, so saving a
`.ts` file hot-reloads in ~1s with **no image rebuild**.

```bash
# Start the API in hot-reload mode (builds the dev image, then watches)
$ npm run docker:dev

# Tail the nest watcher (shows "File change detected → compiling")
$ npm run docker:dev:logs

# Stop the dev API container
$ npm run docker:dev:down
```

Then just edit any `.ts` file and save — nest recompiles inside the container.

Notes:

- **Only rebuild when dependencies change.** If you edit `package.json`, re-run
  `npm run docker:dev` (it always passes `--build`). If you ever see
  `sh: nest: not found`, the anonymous `node_modules` volume is stale from a prior
  production image — flush it once:

  ```bash
  $ docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --renew-anon-volumes api
  ```

- **Migrations do not auto-run in dev mode.** The production `CMD` runs
  `npm run db:bootstrap` on start; `nest start --watch` does not. After a Prisma
  schema change, apply it manually (see [Schema Migration](#schema-migration)).

- To go back to the production container (e.g. on the deploy host):

  ```bash
  $ docker compose up -d --build api
  ```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).


## Schema Migration (schema-per-tenant)

Develop the change on `tenant_template`, fan it out to every tenant, then regenerate.

> `<USER>:<PASS>` must match your `.env` `DATABASE_URL` creds. The database name is `deltra`.
> Never hard-code real secrets in this committed file.

```bash
# 1. Edit prisma/tenant/schema.prisma, then create the migration against the template
DATABASE_URL="postgresql://<USER>:<PASS>@localhost:5432/deltra?schema=tenant_template" \
  npx prisma migrate dev --name your_change --schema=prisma/tenant/schema.prisma

# 1b. ⚠️ REVIEW & SLIM the generated migration.sql before fanning out (see warning below)

# 2. Apply that migration to EVERY tenant schema (serial, with per-tenant reporting)
DATABASE_URL="postgresql://<USER>:<PASS>@localhost:5432/deltra?schema=public" \
  npm run migrate:tenants

# 3. Regenerate the Prisma clients (tenant + public)
npx prisma generate --schema=prisma/tenant/schema.prisma
npx prisma generate
```

> **⚠️ Step 1b is not optional.** `prisma migrate dev` diffs your schema against
> **`tenant_template` specifically** and bundles in any *accumulated drift* it finds —
> enum recreations, `RENAME CONSTRAINT`/`RENAME INDEX` batches, even a
> schema-qualified `DROP TYPE "tenant_template".…`. Those statements encode the
> template's exact object names and **are not portable** — they fail on tenant
> schemas whose constraints/enums drifted independently (`constraint … does not
> exist`, `current transaction is aborted`, etc.). **Open the generated
> `migration.sql` and delete everything that is not your intended change, then make
> the remaining statements idempotent** (`ADD COLUMN IF NOT EXISTS`, guarded
> `CREATE TYPE`). Recover a half-failed tenant: delete its failed row
> (`DELETE FROM <schema>._prisma_migrations WHERE migration_name='…'`) and re-run.

Notes:

- `migrate:tenants` skips `tenant_template` by default (already migrated in step 1).
  `INCLUDE_TEMPLATE=true` to include it; `ONLY=tenant_a,tenant_b` to target a subset.
- Pass `DATABASE_URL` inline in step 2 (with `?schema=public`) — the script reads it from the
  environment to discover tenant schemas; an unset var makes it fail.
- Do **not** use `POST /tenants/migrate-all` — it runs tenants concurrently and flakes on
  Postgres advisory locks. The script runs them one at a time.
- Write each `migration.sql` idempotently (`ADD COLUMN IF NOT EXISTS`, guarded `CREATE TYPE`),
  since some schemas were historically patched with `prisma db push`.
