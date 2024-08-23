import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import type { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { ZProduct, ZProductUpdateInput } from "@formbricks/types/product";
import { cache } from "../cache";
import { ITEMS_PER_PAGE, isS3Configured } from "../constants";
import { environmentCache } from "../environment/cache";
import { createEnvironment } from "../environment/service";
import { deleteLocalFilesByEnvironmentId, deleteS3FilesByEnvironmentId } from "../storage/service";
import { validateInputs } from "../utils/validate";
import { productCache } from "./cache";

const selectProduct = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  organizationId: true,
  languages: true,
  recontactDays: true,
  linkSurveyBranding: true,
  inAppSurveyBranding: true,
  config: true,
  placement: true,
  clickOutsideClose: true,
  darkOverlay: true,
  environments: true,
  styling: true,
  logo: true,
};

export const getProducts = reactCache(
  (organizationId: string, page?: number): Promise<TProduct[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId], [page, ZOptionalNumber]);

        try {
          const products = await prisma.product.findMany({
            where: {
              organizationId,
            },
            select: selectProduct,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });
          return products;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getProducts-${organizationId}-${page}`],
      {
        tags: [productCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const getProductByEnvironmentId = reactCache(
  (environmentId: string): Promise<TProduct | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        let productPrisma;

        try {
          productPrisma = await prisma.product.findFirst({
            where: {
              environments: {
                some: {
                  id: environmentId,
                },
              },
            },
            select: selectProduct,
          });

          return productPrisma;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getProductByEnvironmentId-${environmentId}`],
      {
        tags: [productCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const updateProduct = async (
  productId: string,
  inputProduct: TProductUpdateInput
): Promise<TProduct> => {
  validateInputs([productId, ZId], [inputProduct, ZProductUpdateInput]);
  const { environments, ...data } = inputProduct;
  let updatedProduct;
  try {
    updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        ...data,
        environments: {
          connect: environments?.map((environment) => ({ id: environment.id })) ?? [],
        },
      },
      select: selectProduct,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  try {
    const product = ZProduct.parse(updatedProduct);

    productCache.revalidate({
      id: product.id,
      organizationId: product.organizationId,
    });

    product.environments.forEach((environment) => {
      // revalidate environment cache
      productCache.revalidate({
        environmentId: environment.id,
      });
    });

    return product;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of product failed");
  }
};

export const getProduct = reactCache(
  (productId: string): Promise<TProduct | null> =>
    cache(
      async () => {
        let productPrisma;
        try {
          productPrisma = await prisma.product.findUnique({
            where: {
              id: productId,
            },
            select: selectProduct,
          });

          return productPrisma;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getProduct-${productId}`],
      {
        tags: [productCache.tag.byId(productId)],
      }
    )()
);

export const deleteProduct = async (productId: string): Promise<TProduct> => {
  try {
    const product = await prisma.product.delete({
      where: {
        id: productId,
      },
      select: selectProduct,
    });

    if (product) {
      // delete all files from storage related to this product

      if (isS3Configured()) {
        const s3FilesPromises = product.environments.map(async (environment) => {
          return deleteS3FilesByEnvironmentId(environment.id);
        });

        try {
          await Promise.all(s3FilesPromises);
        } catch (err) {
          // fail silently because we don't want to throw an error if the files are not deleted
          console.error(err);
        }
      } else {
        const localFilesPromises = product.environments.map(async (environment) => {
          return deleteLocalFilesByEnvironmentId(environment.id);
        });

        try {
          await Promise.all(localFilesPromises);
        } catch (err) {
          // fail silently because we don't want to throw an error if the files are not deleted
          console.error(err);
        }
      }

      productCache.revalidate({
        id: product.id,
        organizationId: product.organizationId,
      });

      environmentCache.revalidate({
        productId: product.id,
      });

      product.environments.forEach((environment) => {
        // revalidate product cache
        productCache.revalidate({
          environmentId: environment.id,
        });
        environmentCache.revalidate({
          id: environment.id,
        });
      });
    }

    return product;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const createProduct = async (
  organizationId: string,
  productInput: Partial<TProductUpdateInput>
): Promise<TProduct> => {
  validateInputs([organizationId, ZString], [productInput, ZProductUpdateInput.partial()]);

  if (!productInput.name) {
    throw new ValidationError("Product Name is required");
  }

  const { environments, ...data } = productInput;

  try {
    let product = await prisma.product.create({
      data: {
        config: {
          channel: null,
          industry: null,
        },
        ...data,
        name: productInput.name,
        organizationId,
      },
      select: selectProduct,
    });

    productCache.revalidate({
      id: product.id,
      organizationId: product.organizationId,
    });

    const devEnvironment = await createEnvironment(product.id, {
      type: "development",
    });

    const prodEnvironment = await createEnvironment(product.id, {
      type: "production",
    });

    const updatedProduct = await updateProduct(product.id, {
      environments: [devEnvironment, prodEnvironment],
    });

    return updatedProduct;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
