const fs=require('fs');
const path='C:/Users/Devops/family-hub/packages/api/prisma/schema.prisma';
let c=fs.readFileSync(path,'utf8');
const oldStr='  assignedTo   Member?  @relation(fields: [assignedToId], references: [id])\n  createdAt    DateTime @default(now())\n}';
const newStr='  assignedTo   Member?  @relation(fields: [assignedToId], references: [id])\n  googleEventId String?\n  source        String?  @default("app")\n  createdAt    DateTime @default(now())\n}';
c=c.replace(oldStr,newStr);
fs.writeFileSync(path,c,'utf8');
console.log('done, has googleEventId: '+c.includes('googleEventId'));
