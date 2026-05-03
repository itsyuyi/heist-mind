/** 预设剧本：无需 AI 生成，即刻开玩 */

import { dbSaveScript, dbScriptExists } from "./database.js";

interface PresetCharacter {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  background: string;
  personality: string;
  secret: string;
  goal: string;
  relationships: Record<string, string>;
  avatar_prompt: string;
}

interface PresetClue {
  id: string;
  name: string;
  type: "physical" | "testimony" | "timeline" | "motive";
  description: string;
  source_npc_id: string | null;
  reveal_round: number;
  connections: string[];
}

const PRESETS = [
  {
    id: "preset_republican_spy",
    title: "黎明前的暗影",
    theme: "republican_spy",
    player_count: 6,
    summary:
      "1942 年，上海法租界。一份绝密情报在传递途中失踪，五名嫌疑人被困在法商总会的大厅里。谁是隐藏的日本间谍？谁又是保护情报的地下党员？一场生死较量即将展开。",
    timeline:
      "19:00 情报传递任务启动 → 19:30 情报失踪 → 19:45 所有嫌疑人被控制 → 20:00 调查开始",
    endings: [
      "地下党员成功掩护情报转移，日本间谍被揭露——但代价是一名同志牺牲。",
      "日本间谍成功窃取情报，地下组织遭受重创，但星星之火仍在。",
      "情报在最后一刻被焚毁，所有人都没能得手——一个开放但令人深思的结局。",
    ],
    characters: [
      {
        id: "char_1",
        name: "陈绍安",
        age: 38,
        gender: "男",
        occupation: "法商总会经理",
        background: "表面上是法国人雇用的买办，游走于各方势力之间。西装革履、谈吐优雅，但实际上他曾在日本留学，与一些日本商人有密切联系。最近他经手的几笔大生意让同行怀疑他在为日本人做事。",
        personality: "沉着冷静，善于察言观色，永远带着职业性的微笑，但眼神深处藏着警惕和算计。",
        secret: "你其实是军统潜伏人员，任务是监视法租界内的日本间谍活动。情报失踪的消息让你意识到内部有内鬼。",
        goal: "找出日本间谍，保护情报不落入敌手，同时掩盖自己的真实身份。",
        relationships: {
          "char_2": "你的得力助手，但最近行为有些异常，似乎在私下与某些人不明不白地接触。",
          "char_3": "常来消费的法国商人，出手阔绰但来历不明。",
          "char_4": "新来的歌女，你觉得她不是表面上那么简单。",
          "char_5": "日本商人，你曾在留学时与他有过交集，他可能认出你了。",
          "char_6": "你的老相识，法租界巡捕房的华人探长。",
        },
        avatar_prompt: "1940s Chinese businessman in western suit, slick hair, suspicious eyes, in art deco hotel lobby",
      },
      {
        id: "char_2",
        name: "林若兰",
        age: 28,
        gender: "女",
        occupation: "总会计师",
        background: "出身书香门第，毕业于圣约翰大学。在法商总会担任会计师已有三年，外表文静内敛。实际上她的父亲是一名地下党员，在三年前的一次行动中牺牲，这让她对日本人充满仇恨。",
        personality: "外表文弱，做事一丝不苟，但在关键时刻异常果断。",
        secret: "你是一名地下党员，受命保护一份重要情报。情报就藏在你的账本夹层里。你必须在今晚将它安全转移出去。",
        goal: "在所有人眼皮底下将情报转移给接头人，同时不能暴露自己的身份。",
        relationships: {
          "char_1": "你的上司，你对他一直保持警惕，觉得他太过圆滑世故。",
          "char_3": "经常以商务为由来总会，你觉得他可能在借生意之名做别的事。",
          "char_4": "你和她表面上是同事，但你怀疑她与日本人走得太近。",
          "char_5": "日本商人，你知道他的真实身份是日本军部情报课的成员。",
          "char_6": "巡捕房探长，你父亲的旧友，但你还不能完全信任他。",
        },
        avatar_prompt: "1940s Chinese female accountant, glasses, qipao, quiet but determined expression",
      },
      {
        id: "char_3",
        name: "皮埃尔·杜邦",
        age: 45,
        gender: "男",
        occupation: "法国进出口商人",
        background: "来自里昂的法国商人，在远东经商十五年。表面上是做香料和丝绸贸易，暗地里却与各国情报人员有往来。他是典型的战争投机者——谁的生意都做，哪边都不得罪。",
        personality: "典型的法国绅士，爱喝红酒，健谈幽默，但从不透露自己的真实想法。",
        secret: "你手上有一份各方的联系人名单，如果公开将引发巨大风暴。你本打算今晚与某人交易这份名单，但情报失踪打乱了你的计划。",
        goal: "保住自己的名单安全，同时在各方之间周旋，确保自己能全身而退。",
        relationships: {
          "char_1": "你常来此地，对这位经理的印象不错，但你知道他不简单。",
          "char_2": "你注意到她的账本似乎有些特别，但你不想多管闲事。",
          "char_4": "你被她吸引了，虽然知道这可能是个陷阱。",
          "char_5": "你与他有生意往来，但一直提防着这个日本人。",
          "char_6": "你在巡捕房有些交情，必要时可以寻求他的帮助。",
        },
        avatar_prompt: "1940s French businessman, mustache, glass of wine, in Shanghai French concession",
      },
      {
        id: "char_4",
        name: "苏曼丽",
        age: 24,
        gender: "女",
        occupation: "歌女",
        background: "三个月前来到法商总会的歌女，嗓音甜美，风情万种。实际上她是日本情报机构培训的特工，代号「夜莺」。她利用歌女身份收集各方情报，今晚她的任务是确认一个关键人物的身份。",
        personality: "外表妩媚动人，善于用女性魅力获取信息，但内心冷静且职业。",
        secret: "你是日本间谍「夜莺」，奉命找出隐藏在上海的地下党情报网。但最近你开始对这场战争的意义产生怀疑。",
        goal: "完成收集情报的任务，但内心开始动摇——你在考虑是否要背叛自己的使命。",
        relationships: {
          "char_1": "他是你重点观察的目标，你觉得他身上有秘密。",
          "char_2": "你的同事，你对她有一种奇怪的警惕感。",
          "char_3": "法国商人，你经常用歌声迷惑他套取情报。",
          "char_5": "你的上线，但你们在总会里装作互不相识。",
          "char_6": "你尽量避免与巡捕房的人有交集。",
        },
        avatar_prompt: "1940s Chinese nightclub singer, glamorous cheongsam, stage lights, mysterious smile",
      },
      {
        id: "char_5",
        name: "山本次郎",
        age: 42,
        gender: "男",
        occupation: "日本商会代表",
        background: "公开身份是日本商会在上海的代表，实际上是大本营陆军参谋本部的情报官。他在法租界经营多年，建立了一张庞大的情报网。今晚他收到消息，一份关于日军运输路线的绝密情报正在传递中。",
        personality: "典型的日本军人作风，严谨、克制，但骨子里有一股冷酷狠辣。",
        secret: "你正在追查一份可能暴露日军重要军事部署的情报。你必须不惜一切代价阻止情报传出，哪怕杀人也在所不惜。",
        goal: "截获或销毁那份情报，清除一切可能知道这份情报的人。",
        relationships: {
          "char_1": "你在日本留学时见过他，当时他就是个精明的人。你一直怀疑他是中国情报人员。",
          "char_2": "你注意到她在账目上过于认真，可能是在掩饰什么。",
          "char_3": "法国商人是个墙头草，你利用他获取法租界的信息。",
          "char_4": "她是你的下线，但最近你觉得她有些动摇，需要重新评估。",
          "char_6": "你对巡捕房的人有天然的敌意和警惕。",
        },
        avatar_prompt: "1940s Japanese businessman, stern face, dark suit, in Shanghai, subtle menace",
      },
      {
        id: "char_6",
        name: "赵铁生",
        age: 50,
        gender: "男",
        occupation: "法租界巡捕房探长",
        background: "在法租界巡捕房干了二十年，见惯了各方势力的明争暗斗。他一直试图在混乱中保护华人平民的利益，但夹在法国人和日本人之间左右为难。他认识不少地下党人士，但一直装作不知。",
        personality: "粗中有细，说话慢悠悠但每句都有分量，外表粗犷但心思缜密。",
        secret: "你一直在暗中保护地下党的活动，知道今晚有重要情报需要转移。但同时你也收到了日本人的威胁——不配合他们就伤害你的家人。",
        goal: "在保护情报和保全家人之间找到出路，同时找出真正的间谍。",
        relationships: {
          "char_1": "你的老友，但你最近对他有些怀疑。",
          "char_2": "你朋友的女儿，你想要保护她，但不能做得太明显。",
          "char_3": "你对法国人没有信任，但不得不维持表面关系。",
          "char_4": "你觉得这个歌女过于主动，肯定有来头。",
          "char_5": "你知道他是日本情报人员，但没有确凿证据。",
        },
        avatar_prompt: "1940s Chinese police inspector, weathered face, detective coat, Shanghai French concession",
      },
    ] as PresetCharacter[],
    clues: [
      {
        id: "clue_1", name: "撕毁的纸条", type: "physical",
        description: "在沙发缝隙里发现的半张纸条，上面写着「今晚……码头……货」，笔迹潦草，纸张上有些许水渍，似乎是匆忙中撕下的。",
        source_npc_id: "char_2", reveal_round: 1, connections: ["clue_3"],
      },
      {
        id: "clue_2", name: "山本的怀表", type: "physical",
        description: "山本次郎从不离身的怀表，但内侧暗格里藏着一张微型胶片，上面是上海的码头地图，标注了若干军事设施的位置。",
        source_npc_id: "char_5", reveal_round: 2, connections: ["clue_5"],
      },
      {
        id: "clue_3", name: "账本密码", type: "physical",
        description: "林若兰的账本中有一页使用了特殊的记账法，看似是普通的支出记录，实际解码后是一个地址和一个时间。",
        source_npc_id: "char_2", reveal_round: 2, connections: ["clue_1", "clue_4"],
      },
      {
        id: "clue_4", name: "杜邦的访客记录", type: "testimony",
        description: "侍者记得杜邦在情报失踪前接待过一位神秘访客，那人戴着帽子压得很低，但侍者认出他手腕上有一个特殊的纹身——日本海军旗。",
        source_npc_id: "char_3", reveal_round: 1, connections: ["clue_5"],
      },
      {
        id: "clue_5", name: "歌女的化妆盒", type: "physical",
        description: "苏曼丽的化妆盒底层藏着一台微型发报机的零件，以及一份用日文写的任务指令：「确认燕子身份，必要时清除。」",
        source_npc_id: "char_4", reveal_round: 3, connections: ["clue_2", "clue_6"],
      },
      {
        id: "clue_6", name: "陈绍安的留学照", type: "physical",
        description: "陈绍安办公室抽屉里有一张旧照片，是他在东京留学时与一群日本人拍的合影。照片反面用铅笔写着「昭和十四年，特训班」。",
        source_npc_id: "char_1", reveal_round: 2, connections: ["clue_7"],
      },
      {
        id: "clue_7", name: "赵探长的信件", type: "testimony",
        description: "赵探长收到的一封威胁信，用剪报拼贴而成：「你有一个漂亮的女儿，让她远离今晚的大厅。」邮戳显示寄出时间是今天下午。",
        source_npc_id: "char_6", reveal_round: 3, connections: ["clue_6", "clue_8"],
      },
      {
        id: "clue_8", name: "带血的丝巾", type: "physical",
        description: "在后门垃圾桶里发现的丝绸手帕，沾有血迹。手帕一角绣着一个「M」字——和杜邦名字的首字母吻合。",
        source_npc_id: null, reveal_round: 3, connections: ["clue_4"],
      },
    ] as PresetClue[],
  },
];

export function seedPresets(): void {
  if (dbScriptExists()) {
    console.log("[Presets] 数据库已存在剧本，跳过预设种子");
    return;
  }

  for (const preset of PRESETS) {
    const script = {
      id: preset.id,
      title: preset.title,
      theme: preset.theme,
      player_count: preset.player_count,
      summary: preset.summary,
      timeline: preset.timeline,
      endings: preset.endings,
      characters: preset.characters,
      clues: preset.clues.map((c, i) => ({
        ...c,
        ...(i < 4 ? { reveal_round: 1 } : i < 7 ? { reveal_round: 2 } : { reveal_round: 3 }),
      })),
      npc_count: preset.player_count,
      rounds: 5,
      estimated_tokens: 0,
    };

    dbSaveScript(script);
    console.log(`[Presets] 已植入预设剧本: ${preset.title}`);
  }

  console.log(`[Presets] 共植入 ${PRESETS.length} 个预设剧本`);
}
