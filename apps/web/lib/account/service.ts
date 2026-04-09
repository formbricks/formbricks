import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { TAccount, TAccountInput, ZAccountInput } from "@formbricks/types/account";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "../utils/validate";

export const createAccount = async (accountData: TAccountInput): Promise<TAccount> => {
  validateInputs([accountData, ZAccountInput]);

  try {
    const account = await prisma.account.create({
      data: accountData,
    });
    return account;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const upsertAccount = async (accountData: TAccountInput): Promise<TAccount> => {
  const [validatedAccountData] = validateInputs([accountData, ZAccountInput]);
  const updateAccountData: Omit<TAccountInput, "userId" | "type" | "provider" | "providerAccountId"> = {
    access_token: validatedAccountData.access_token,
    refresh_token: validatedAccountData.refresh_token,
    expires_at: validatedAccountData.expires_at,
    scope: validatedAccountData.scope,
    token_type: validatedAccountData.token_type,
    id_token: validatedAccountData.id_token,
  };

  try {
    const account = await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: validatedAccountData.provider,
          providerAccountId: validatedAccountData.providerAccountId,
        },
      },
      create: validatedAccountData,
      update: updateAccountData,
    });

    return account;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
