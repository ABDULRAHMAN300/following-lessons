import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/robots.txt")({server:{handlers:{GET:async()=>new Response("User-agent: *\nDisallow: /\n",{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"public, max-age=86400"}})}}});
