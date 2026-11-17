import {z} from 'zod';
const text=(max=4000)=>z.string().trim().min(1).max(max);
const svg=text(180000).refine(value=>/^<svg\b/i.test(value)&&/<\/svg>\s*$/i.test(value)&&!/<\s*(?:script|foreignObject|iframe|image|use|style|animate\w*|set|a)\b|\bon\w+\s*=|(?:href|src)\s*=|url\s*\(|<!|<\?/i.test(value),'Use standalone SVG shapes/text only; no scripts, links, embedded resources or animation');
export const comicSchema=z.object({
 version:z.literal(1),status:z.enum(['draft','reviewed']),
 brief:z.object({objective:text(),audience:text(500),language:text(100),style:text(),userConfirmation:text(),confirmed:z.literal(true)}).strict(),
 panels:z.array(z.object({id:text(200),title:text(300),visualDescription:text(),caption:text(),dialogue:z.array(z.object({speaker:text(100),text:text(2000)}).strict()).max(12),alt:text(),illustrationSvg:svg.optional(),imageData:z.string().max(300000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).optional()}).strict().refine(p=>!(p.illustrationSvg&&p.imageData),'Choose one image format per panel')).min(1).max(24),
 sources:z.array(z.object({label:text(500),reference:text(2000)}).strict()).max(30),
 review:z.object({accuracy:z.boolean(),sequence:z.boolean(),text:z.boolean(),visuals:z.boolean(),userStyle:z.boolean(),notes:text(12000),issues:z.array(text()).max(30)}).strict()
}).strict().superRefine((comic,ctx)=>{
 if(new Set(comic.panels.map(p=>p.id)).size!==comic.panels.length)ctx.addIssue({code:'custom',message:'Panel IDs must be unique',path:['panels']});
 if(comic.status==='reviewed'){
  if(!comic.sources.length)ctx.addIssue({code:'custom',message:'Reviewed comics require actual source references',path:['sources']});
  if(!comic.panels.every(p=>p.illustrationSvg||p.imageData))ctx.addIssue({code:'custom',message:'Reviewed comics require an illustration for every panel',path:['panels']});
  if(!['accuracy','sequence','text','visuals','userStyle'].every(key=>comic.review[key as keyof typeof comic.review]===true)||comic.review.issues.length)ctx.addIssue({code:'custom',message:'Complete all checks and resolve issues before marking reviewed',path:['review']});
 }
});
export type ComicDocument=z.infer<typeof comicSchema>;
export function parseComic(content:string):ComicDocument{return comicSchema.parse(JSON.parse(content));}
export const comicRequest='Bantu saya membuat komik pembelajaran untuk bank ini. Sebelum membuat storyboard atau desain, klarifikasi tujuan belajar, cakupan fakta/sumber, tingkat pembaca, bahasa, jumlah panel, serta gaya yang saya inginkan; tunggu jawaban saya. Utamakan akurasi dan preferensi saya, jangan memaksakan estetika atau minimalisme. Gunakan get_comic_guide. Setelah membuatnya, periksa hasil visual aktual, teks, urutan panel, akurasi terhadap sumber, serta kesesuaian gaya. Perbaiki temuan, simpan sebagai artifact kind comic, baca kembali hasil tersimpan, dan laporkan pemeriksaan yang benar-benar dilakukan. Jangan tandai reviewed jika belum bisa memeriksa visualnya.';
export const comicGuide={
 version:'1.0.0',storage:{artifactKind:'comic',content:'JSON.stringify(document)',maximumContentCharacters:500000,bankRequired:true},
 workflow:['Clarify the learning objective, audience, source material, language, panel count, characters and desired style. Wait for the user before designing. Reuse explicit preferences; ask only about missing decisions or confirm the assembled brief.','Prioritize factual accuracy and the requested style. Do not impose minimalism, prettiness or any default art direction. Distinguish educational metaphors from literal mechanisms.','Create a draft with stable panel IDs, readable dialogue, captions and actual source references. Use SVG illustrations or embedded PNG/JPEG/WebP images. If a native image cannot be transferred, explain the limit; never invent an accessible URL or an attachment.','Inspect the actual rendered comic or image, compare facts against sources, check sequence, spelling, labels, readability and user style. Fix issues and repeat affected checks. An unrendered storyboard stays draft.','Use create_artifact or update_artifact with a fresh operationId and current expectedRevision. Read back with get_artifact, validate content and report checks and limitations. reviewed is a creator-reported checklist, not independent verification.'],
 documentSchema:z.toJSONSchema(comicSchema,{io:'input'}),
 rendering:{svg:'Static standalone SVG shapes and text; displayed as an image, never executable HTML.',raster:'Embedded data:image/png|jpeg|webp;base64,... only. No remote image URLs.',transcript:'Captions and dialogue are separately rendered text for readability and accessibility.'}
};
