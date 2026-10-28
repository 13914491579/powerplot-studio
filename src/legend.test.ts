import {describe,it,expect} from 'vitest';
import {arrange} from './legend';
describe('精细图例布局',()=>{
 it('均匀分布按文字宽度计算余量',()=>{const p=arrange([20,80,40],200,12,5,3,0,true,'justify');expect(p.map(x=>x.x)).toEqual([0,50,160]);});
 it('横向和垂直间距',()=>{expect(arrange([20,30],200,12,8,5,0,false,'left')[1].x).toBe(28);expect(arrange([20,30],200,12,8,5,1,false,'left')[1].y).toBe(17);});
 it('换行及列上限',()=>{expect(arrange([70,70,70],150,12,8,5,0,true,'left')[2].y).toBe(17);expect(arrange([10,10,10],150,12,8,5,2,true,'left')[2].y).toBe(17);});
 it('居中与右对齐',()=>{expect(arrange([20],100,12,5,3,0,true,'center')[0].x).toBe(40);expect(arrange([20],100,12,5,3,0,true,'right')[0].x).toBe(80);});
});
