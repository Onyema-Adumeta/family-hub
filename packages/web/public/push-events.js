self.addEventListener('push', function(event) {
 let message={title:'Kinroost',body:'You have a family update.',url:'/'};
 try {if(event.data) message=Object.assign(message,event.data.json());} catch(_) {}
 let target=new URL(message.url || '/',self.location.origin);
 if(target.origin!==self.location.origin) target=new URL('/',self.location.origin);
 event.waitUntil(self.registration.showNotification(message.title,{body:message.body,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:target.href}}));
});
self.addEventListener('notificationclick',function(event) {
 event.notification.close();
 const target=new URL(event.notification.data?.url || '/',self.location.origin);
 if(target.origin!==self.location.origin)return;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  for(const client of clients) {if(new URL(client.url).origin===target.origin){await client.navigate(target.href);return client.focus();}}
  return self.clients.openWindow(target.href);
 }));
});
