locals {
  env_roles = {
    staging    = { dev_users = "ro", ops_users = "rw", admin_users = "admin" }
    production = { dev_users = "ro", ops_users = "ro", admin_users = "admin" }
  }

  # List of application user identities
  app_users = {
    dev_users = [
      "harsh",
    ]
    ops_users = [
      "piotr",
    ]
    admin_users = [
      "johannes",
      "matti",
    ]
  }

  # Flatten users across all teams, creating a map of username => role
  db_users = merge([
    for team, users in local.app_users : {
      for user in users : user => {
        role = local.env_roles[var.env_name][team]
      }
    }
  ]...)

  # FIXME: this shouldn't be hardcoded here
  rds_database_name = "formbricks-cloud"

  role_prefix = replace(local.rds_database_name, "-", "_")

  # Map of username => role
  sql_users_map = merge([
    for team, users in local.app_users : {
      for user in users : user => {
        role = "${local.role_prefix}_user_${local.env_roles[var.env_name][team]}"
      }
    }
  ]...)

  # SQL to create read-only role
  sql_create_read_only_role = {
    sql = <<EOF
      DO
      \$\$
      DECLARE
        schema_name TEXT;
      BEGIN
        -- Create the read-only role if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${local.role_prefix}_user_ro') THEN
          CREATE ROLE ${local.role_prefix}_user_ro;
        END IF;

        -- Loop through all schemas in the database, excluding system schemas
        FOR schema_name IN
          SELECT schemata.schema_name
          FROM information_schema.schemata AS schemata
          WHERE schemata.catalog_name = '${local.rds_database_name}'
          AND schemata.schema_name NOT IN ('pg_catalog', 'information_schema')
        LOOP
          -- Grant USAGE on the schema
          EXECUTE format('GRANT USAGE ON SCHEMA %I TO ${local.role_prefix}_user_ro;', schema_name);

          -- Grant SELECT on all tables in the schema
          EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO ${local.role_prefix}_user_ro;', schema_name);
        END LOOP;
      END
      \$\$;
    EOF
  }

  # SQL to create read-write role
  sql_create_read_write_role = {
    sql = <<EOF
      DO
      \$\$
      DECLARE
        schema_name TEXT;
      BEGIN
        -- Create the read-write role if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${local.role_prefix}_user_rw') THEN
          CREATE ROLE ${local.role_prefix}_user_rw;
        END IF;

        -- Loop through all schemas in the database, excluding system schemas
        FOR schema_name IN
          SELECT schemata.schema_name
          FROM information_schema.schemata AS schemata
          WHERE schemata.catalog_name = '${local.rds_database_name}'
          AND schemata.schema_name NOT IN ('pg_catalog', 'information_schema')
        LOOP
          -- Grant USAGE and CREATE on the schema
          EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO ${local.role_prefix}_user_rw;', schema_name);

          -- Grant CRUD permissions on all existing tables
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO ${local.role_prefix}_user_rw;', schema_name);
        END LOOP;
      END
      \$\$;
    EOF
  }

  # SQL to create admin role
  sql_create_admin_role = {
    sql = <<EOF
      DO
      \$\$
      DECLARE
        schema_name TEXT;
      BEGIN
        -- Create the admin role if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${local.role_prefix}_user_admin') THEN
          CREATE ROLE ${local.role_prefix}_user_admin;
        END IF;

        -- Loop through all schemas in the database, excluding system schemas
        FOR schema_name IN
          SELECT schemata.schema_name
          FROM information_schema.schemata AS schemata
          WHERE schemata.catalog_name = '${local.rds_database_name}'
          AND schemata.schema_name NOT IN ('pg_catalog', 'information_schema')
        LOOP
          -- Grant USAGE and CREATE on the schema (allowing schema usage and object creation)
          EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO ${local.role_prefix}_user_admin;', schema_name);

          -- Grant INSERT, UPDATE, DELETE on existing tables in the schema
          EXECUTE format('GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO ${local.role_prefix}_user_admin;', schema_name);

          -- Grant full privileges on schema (implicitly includes ability to alter the schema)
          EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA %I TO ${local.role_prefix}_user_admin;', schema_name);

          -- Grant the ability to drop tables (delete tables) by owning the tables
          EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO ${local.role_prefix}_user_admin;', schema_name);
        END LOOP;
      END
      \$\$;
    EOF
  }

  # Generate SQL statements to create users and set passwords
  sql_create_user = {
    for user, user_info in local.sql_users_map : user => {
      sql = <<EOF
        DO
        \$\$
        BEGIN
          -- Create user if it does not exist
          IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '${user}') THEN
              EXECUTE format('CREATE USER %I WITH PASSWORD %L;', '${user}', '${random_password.db_user_secrets[user].result}');
          ELSE
              -- Update password if the user already exists
              EXECUTE format('ALTER USER %I WITH PASSWORD %L;', '${user}', '${random_password.db_user_secrets[user].result}');
          END IF;

          -- Ensure role exists
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${user_info.role}') THEN
            RAISE EXCEPTION 'Role ${user_info.role} does not exist';
          END IF;

          -- Assign role to the user
          EXECUTE format('GRANT %I TO %I;', '${user_info.role}', '${user}');
        END
        \$\$;
      EOF
    }
  }
}
