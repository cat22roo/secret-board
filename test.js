'use strict';
const pug = require('pug');
const assert = require('assert');

const html = pug.renderFile('./views/posts.pug',{
  posts: [
   {
    id: 1,
    content: "<script>alert('test');</script>",
    postedBy: 'guest1',
    trackingCookie: '4890423326082307_595a6f63b20f2249e85d3e7fce823f368fc5493f',
    createdAt: new Date(), 
    updatedAt: new Date()
   }
  ],
  user:'guest1'
});
// console.log(html);

assert(html.includes("&lt;script&gt;alert('test');&lt;/script&gt;"));
console.log('テストが完了しました');