import redis.asyncio as aioredis


async def get_redis_client():
    return await aioredis.from_url('redis://localhost:6379/0')