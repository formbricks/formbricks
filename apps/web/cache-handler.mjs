// import { CacheHandler } from "@neshca/cache-handler";
// import createLruHandler from "@neshca/cache-handler/local-lru";
// CacheHandler.onCreation(async () => {
//   const REDIS_CLIENT_URL = "http://localhost:7379";
//   const keyPrefix = "formbrics-redis-cache:";
//   const sharedTagsKey = "_sharedTags_";
//   const encodeKey = (key) => key.replace(/\//g, "-");
//   const customRedisHandler = {
//     // This name helps when the NEXT_PRIVATE_DEBUG_CACHE is set to 1 to identify the cache handler
//     name: "formbricks-custom-redis-cache",
//     async get(key) {
//       try {
//         const encodedKey = encodeKey(key);
//         let response = await fetch(`${REDIS_CLIENT_URL}/GET/${keyPrefix}${encodedKey}`);
//         const data = await response.text();
//         let parsedData;
//         try {
//           parsedData = JSON.parse(data);
//         } catch (error) {
//           console.error("Error parsing JSON from Redis:", error);
//         }
//         return parsedData.GET ? JSON.parse(parsedData.GET) : null;
//       } catch (error) {
//         throw error; // Rethrow the error so CacheHandler can use the next available handler.
//       }
//     },
//     async set(key, cacheHandlerValue) {
//       try {
//         const encodedKey = encodeKey(key);
//         const value = JSON.stringify(cacheHandlerValue);
//         const encodedValue = encodeURIComponent(value);
//         let response = await fetch(`${REDIS_CLIENT_URL}/SET/${keyPrefix}${encodedKey}/${encodedValue}`);
//         if (!response.ok) {
//           throw new Error(`Failed to set key in Redis: ${response}`);
//         }
//         if (cacheHandlerValue.lifespan) {
//           response = await fetch(
//             `${REDIS_CLIENT_URL}/EXPIREAT/${keyPrefix}${encodedKey}/${cacheHandlerValue.lifespan.expireAt}`
//           );
//           if (!response.ok) {
//             throw new Error(`Failed to expireAt key in Redis: ${response}`);
//           }
//         }
//         if (cacheHandlerValue.tags.length) {
//           response = await fetch(
//             `${REDIS_CLIENT_URL}/HSET/${keyPrefix}${sharedTagsKey}/${JSON.stringify({ [encodedKey]: JSON.stringify(cacheHandlerValue.tags) })}`
//           );
//           if (!response.ok) {
//             throw new Error(`Failed to hset in set key in Redis: ${response}`);
//           }
//         }
//       } catch (error) {
//         console.error("Error in handler.set:", error);
//         throw error; // Rethrow the error so CacheHandler can use the next available handler.
//       }
//     },
//     async revalidateTag(tag) {
//       try {
//         console.log("revalidateTag", tag);
//         let response = await fetch(`${REDIS_CLIENT_URL}/HGETALL/${keyPrefix}${sharedTagsKey}`);
//         if (!response.ok) {
//           throw new Error(`Failed to get tags from Redis: ${response.statusText}`);
//         }
//         const remoteTags = await response.json();
//         const tagsMap = new Map(Object.entries(remoteTags.HGETALL));
//         console.log("tagsMap", tagsMap);
//         const keysToDelete = [];
//         const tagsToDelete = [];
//         for (const [key, tagsString] of tagsMap) {
//           const tags = JSON.parse(tagsString);
//           if (tags.includes(tag)) {
//             keysToDelete.push(encodeURIComponent(keyPrefix + encodeKey(key)));
//             tagsToDelete.push(encodeURIComponent(encodeKey(key)));
//           }
//         }
//         console.log("keysToDelete parsed", keysToDelete);
//         // Delete each key individually
//         // for (const key of keysToDelete) {
//         const unlinked = await fetch(`${REDIS_CLIENT_URL}/UNLINK/${keysToDelete}`);
//         if (!unlinked.ok) {
//           throw new Error(`Failed to unlink in Redis: ${unlinked}`);
//         }
//         // }
//         // Delete each tag field individually
//         // for (const tag of tagsToDelete) {
//         const hdel = await fetch(`${REDIS_CLIENT_URL}/HDEL/${keyPrefix}${sharedTagsKey}/${tagsToDelete}`);
//         if (!hdel.ok) {
//           throw new Error(`Failed to hdel tag in Redis: ${hdel}`);
//         }
//         // }
//       } catch (error) {
//         console.error("Error in handler.revalidateTag:", error);
//         throw error; // Rethrow the error so CacheHandler can use the next available handler.
//       }
//     },
//   };
//   const localHandler = createLruHandler();
//   return {
//     handlers: [customRedisHandler, localHandler],
//   };
// });
// export default CacheHandler;
import { CacheHandler } from "@neshca/cache-handler";
import createLruHandler from "@neshca/cache-handler/local-lru";
import createRedisHandler from "@neshca/cache-handler/redis-strings";
import { createClient } from "redis";

CacheHandler.onCreation(async () => {
  let redisHandler;
  console.log("REDIS_CLIENT_URL in cache handler", process.env.REDIS_CLIENT_URL);
  if (process.env.REDIS_CLIENT_URL) {
    console.log("creating client");
    const client = createClient({
      url: process.env.REDIS_CLIENT_URL,
    });
    client.on("error", (e) => {
      console.log("Error in conncting to Redis client", e);
    });

    console.log("awaiting client connection");
    await client.connect();
    console.log("client connected");
    redisHandler = createRedisHandler({
      client,
      timeoutMs: 5000,
    });
    console.log("redisHandler created");
  }

  const localHandler = createLruHandler();
  return {
    handlers: [redisHandler, localHandler],
  };
});

export default CacheHandler;
