from mitmproxy import http
import asyncio
import json
import websockets

clients = set()

async def ws_handler(websocket):
    clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        clients.remove(websocket)

async def broadcast(data):
    if clients:
        msg = json.dumps(data)
        await asyncio.wait([c.send(msg) for c in clients])


def request(flow: http.HTTPFlow):
    data = {
        "type": "request",
        "url": flow.request.pretty_url,
        "method": flow.request.method,
        "body": flow.request.text
    }

    asyncio.get_event_loop().create_task(broadcast(data))


def response(flow: http.HTTPFlow):
    data = {
        "type": "response",
        "url": flow.request.pretty_url,
        "status": flow.response.status_code,
        "body": flow.response.text[:2000]
    }

    asyncio.get_event_loop().create_task(broadcast(data))
