import test from 'node:test';
import assert from 'node:assert/strict';
import { productSchema } from '@impresion3d/shared';
const product = {name:'Adorno',description:'Adorno de 5 cm',category:'Navidad',color:'sand',priceCents:350000,currency:'ARS',active:true};
test('permite publicar la altura confirmada sin inventar ancho ni profundidad', () => {
  const result=productSchema.parse({...product,dimensions:{height:50}});
  assert.deepEqual(result.dimensions,{height:50});
});
test('exige altura positiva y rechaza medidas conocidas inválidas', () => {
  for(const dimensions of [{},{height:0},{height:50,width:0},{height:50,depth:-1}])
    assert.equal(productSchema.safeParse({...product,dimensions}).success,false);
});
