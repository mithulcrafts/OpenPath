import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { z } from 'zod';

interface Item { sku: string; color: string; size: string; quantity: number; }
interface Cart { items: Item[]; lastUsed: number; }
const carts = new Map<string, Cart>();
const itemSchema = z.object({
  sku:z.literal('everyday-tee'),color:z.enum(['blue','sand','black']),size:z.enum(['S','M','L','XL']),quantity:z.number().int().min(1).max(5),
}).strict();

function cartFor(req: Request,res: Response) {
  const now=Date.now();
  for(const [id,cart] of carts) if(now-cart.lastUsed>3600000) carts.delete(id);
  let id=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('op_demo='))?.slice(8);
  if(!id || !carts.has(id)) {
    if(carts.size>=1000) carts.delete(carts.keys().next().value!);
    id=randomUUID();carts.set(id,{items:[],lastUsed:now});
    res.cookie('op_demo',id,{httpOnly:true,sameSite:'strict',path:'/demo',maxAge:3600000});
  }
  const cart=carts.get(id)!;cart.lastUsed=now;return cart;
}

export function mountDemoApi(app: Express) {
  app.get('/demo/api/cart',(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({items:cartFor(req,res).items});});
  app.post('/demo/api/cart',(req,res)=>{
    const parsed=itemSchema.safeParse(req.body);
    if(!parsed.success){res.status(400).json({error:'Choose a valid product, colour, size and quantity.'});return;}
    const cart=cartFor(req,res);const item=parsed.data;
    const existing=cart.items.find(i=>i.sku===item.sku&&i.color===item.color&&i.size===item.size);
    if(existing) existing.quantity=Math.min(10,existing.quantity+item.quantity);else cart.items.push(item);
    res.json({items:cart.items});
  });
  app.post('/demo/api/cart/reset',(req,res)=>{const cart=cartFor(req,res);cart.items=[];res.json({items:[]});});
}
