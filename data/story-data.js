// data/story-data.js
// Project: 기억 압류 관리국: 404호 소각로 (Incinerator No. 404)
//
// 작성: 제미나이 (시나리오 v1). 대사·텍스트는 제미나이 원문 그대로다.
// "[Claude]" 주석이 붙은 줄만 엔진 연결을 위해 Claude가 추가했다. (제미나이 원문의 결과 문장을 기능으로 옮긴 것)
// 이 파일의 형식 차이(assets.portraits, notebook.linkedMemoryId/redactKeyword, endings.triggerKeywords 등)는
// 엔진의 호환 계층(js/engine.js adaptData)이 규격(docs/DATA_SCHEMA.md)으로 변환한다.

window.GAME_DATA = {
  meta: {
    title: "기억 압류 관리국: 404호 소각로",
    version: "1.0.0",
    protagonistId: "0404",
    heroineName: "이리나",
    gameOverEnding: "quotaFailure" // [Claude] 감찰 의심도 한도 도달 시 Ending C 로 연결 (triggerKeywords 가 비어 있는 엔딩)
  },

  assets: {
    backgrounds: {
      deskNormal: "assets/bg/desk_404_normal.png",
      deskDim: "assets/bg/desk_404_dim.png",
      incineratorCore: "assets/bg/incinerator_core.png",
      snowfield: "assets/bg/white_silence_snowfield.png"
    },
    portraits: {
      inspector: {
        neutral: "assets/chars/inspector_neutral.png",
        stern: "assets/chars/inspector_stern.png"
      },
      irina: {
        neutral: "assets/chars/irina_neutral.png",
        smile: "assets/chars/irina_smile.png",
        sad: "assets/chars/irina_sad.png",
        glitch: "assets/chars/irina_glitch.png"
      },
      citizen: {
        neutral: "assets/chars/citizen_shadow.png",
        hollow: "assets/chars/citizen_shadow.png"
      }
    }
  },

  notebook: [
    {
      id: "note_1",
      linkedMemoryId: "mem_103",
      redactKeyword: "이리나",
      title: "수첩 첫 장의 낡은 메모",
      text: "내 사번은 0404. 이유를 알 수 없지만 비가 오는 날이면 낡은 성당 종탑과 이리나라는 이름이 떠오른다."
    },
    {
      id: "note_2",
      linkedMemoryId: "mem_203",
      redactKeyword: "호밀빵",
      title: "식성 기록",
      text: "관리국 배급 식단은 역겹다. 나는 탄 자국이 있는 따뜻한 호밀빵과 설탕을 태운 홍차를 좋아했던 것 같다."
    },
    {
      id: "note_3",
      linkedMemoryId: "mem_303",
      redactKeyword: "자장가",
      title: "수면 장애 기록",
      text: "소각로 열기가 거세질 때마다 악몽을 꾼다. 누군가 내 귀에 낮게 흥얼거려 주던 단조풍의 자장가 선율만이 두통을 가라앉힌다."
    },
    {
      id: "note_4",
      linkedMemoryId: "mem_403",
      redactKeyword: "방화범",
      title: "사번 0404의 진실",
      text: "나는 모범 공무원이 아니었다. 나는 가짜 도시 카르타의 영사기를 부수려다 체포된 등대 테러범이자 방화범이었다."
    },
    {
      id: "note_5",
      linkedMemoryId: "mem_502",
      redactKeyword: "약속",
      title: "마지막 페이지",
      text: "기억이 전부 재가 되어도, 눈 덮인 진짜 세상에서 다시 만나자는 약속만은 태우지 않기로 했다."
    }
  ],

  chapters: [
    {
      id: "ch1",
      day: 1,
      title: "제1일차: 정상 영업",
      quota: 300,
      background: "assets/bg/desk_404_normal.png",
      dialogues: [
        {
          speaker: "감찰관",
          expression: "neutral",
          portrait: "assets/chars/inspector_neutral.png",
          text: "404호, 오늘치 압류품이다. 외곽 구역의 백색 침묵이 짙어지고 있으니 할당 열량 300칼로리를 반드시 채워라.",
          bgmMood: "tense"
        },
        {
          speaker: "감찰관",
          expression: "stern",
          portrait: "assets/chars/inspector_stern.png",
          text: "판독기에 꽂아 등급만 확인하고 바로 소각로에 던져 넣어라. 채무자들의 구질구질한 사연에 사사로운 감정을 섞지 말고.",
          bgmMood: "tense"
        },
        {
          speaker: "시스템",
          expression: "neutral",
          portrait: null,
          text: "[업무 개시] 서류철에서 기억 결정을 판독기에 올려 열량을 확인하고, [소각] 또는 [은닉]을 결정하십시오.",
          bgmMood: "work"
        }
      ],
      seizedMemories: [
        {
          id: "mem_101",
          owner: "시민 #8821 (3개월 세금 연체자)",
          title: "아이의 첫 걸음마",
          grade: "B",
          previewText: "좁은 단칸방 마룻바닥. 비틀거리며 내 검지손가락을 꽉 잡던 작고 따뜻한 손의 온기와 서툰 웃음소리.",
          calories: 150,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +150. 내일 시민 #8821이 창구에 찾아와 왜 자기 집에 작은 아기 신발이 있는지 묻는다.",
          hideConsequence: "할당량 미달 위험. 서랍에 은닉됨. 시민 #8821의 기억이 온전히 보존된다."
        },
        {
          id: "mem_102",
          owner: "시민 #3094 (등대 난방비 체납자)",
          title: "스무 살 겨울의 합격 통지서",
          grade: "B",
          previewText: "얼어붙은 손으로 봉투를 뜯던 골목길. 가로등 불빛 아래서 '최종 합격' 네 글자를 읽고 어머니를 부둥켜안던 밤.",
          calories: 150,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +150. 시민 #3094는 자신이 왜 지금의 직장에서 일하고 있는지 동기를 잃어버린다.",
          hideConsequence: "할당량 미달 위험. 서랍에 은닉됨. 감찰관의 의심도가 소폭 상승한다."
        },
        {
          id: "mem_103",
          owner: "채무자 불명 (라벨 훼손됨)",
          title: "종탑 아래의 빗소리와 소녀",
          grade: "S",
          previewText: "무너진 성당의 종탑 아래. 잿빛 비를 피하며 내 외투 자락을 붙잡고 웃던 소녀. '내 이름은 이리나야, 잊지 마.'",
          calories: 250,
          isProtagonistMemory: true,
          redactKeyword: "이리나",
          burnConsequence: "할당량 +250 초과 달성. 개인 수첩에서 '이리나'라는 이름이 영구히 '███'로 소각된다.",
          hideConsequence: "서랍 깊숙이 은닉됨. 수첩의 첫 페이지 기록이 선명하게 유지된다."
        }
      ]
    },

    {
      id: "ch2",
      day: 2,
      title: "제2일차: 창구 너머의 잔상",
      quota: 400,
      background: "assets/bg/desk_404_normal.png",
      dialogues: [
        {
          speaker: "시민 #8821",
          expression: "hollow",
          portrait: "assets/chars/citizen_shadow.png",
          text: "저기요, 공무원 양반... 내 방 구석에 웬 작은 유아용 신발이 놓여 있던데, 혹시 내가 뭘 압류당했는지 아십니까?",
          bgmMood: "melancholy"
        },
        {
          speaker: "이리나",
          expression: "smile",
          portrait: "assets/chars/irina_smile.png",
          text: "(시민이 떠난 창구 너머에 낯익은 소녀가 서 있다) 안녕, 404호. 오늘도 표정이 딱딱하네. 검지손가락으로 책상을 두드리는 버릇은 여전하고.",
          bgmMood: "mystery"
        },
        {
          speaker: "이리나",
          expression: "neutral",
          portrait: "assets/chars/irina_neutral.png",
          text: "날 처음 본다는 얼굴이네. 괜찮아, 네가 잊어버린 건 내가 전부 기억하고 있으니까. 오늘 압류품 중에 네 것이 또 섞여 있을 거야.",
          bgmMood: "mystery"
        }
      ],
      seizedMemories: [
        {
          id: "mem_201",
          owner: "시민 #5110 (상업 구역 제빵사)",
          title: "어머니의 비밀 발효 반죽법",
          grade: "A",
          previewText: "새벽 4시 화덕 앞. 밀가루가 묻은 어머니의 주름진 손이 내 손을 포개어 반죽의 숨결을 느끼게 해주던 감각.",
          calories: 200,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +200. 3구역 베이커리에서 더 이상 고소한 빵 냄새가 나지 않는다.",
          hideConsequence: "할당량 확보 실패 위험. 제빵사의 기술이 지켜진다."
        },
        {
          id: "mem_202",
          owner: "시민 #1902 (퇴역 경비대원)",
          title: "전우의 마지막 유언",
          grade: "A",
          previewText: "백색 침묵이 덮치던 외곽 초소. 나를 방벽 안으로 밀어 넣고 문고리를 걸어 잠그던 친구의 피 묻은 미소.",
          calories: 200,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +200. 퇴역 경비대원은 다리를 절뚝거리면서도 왜 다쳤는지 기억하지 못한다.",
          hideConsequence: "할당량 확보 실패 위험. 서랍에 은닉됨."
        },
        {
          id: "mem_203",
          owner: "사번 #0404 (작성자 본인 필체)",
          title: "나눠 먹던 탄 호밀빵",
          grade: "S",
          previewText: "배급소가 닫힌 추운 밤, 이리나가 품에서 꺼내 반으로 쪼개 준 탄 호밀빵. 세상에서 가장 달콤했던 잿빛 식사.",
          calories: 250,
          isProtagonistMemory: true,
          redactKeyword: "호밀빵",
          burnConsequence: "할당량 +250. 개인 수첩에서 '호밀빵'에 대한 기억이 '███'로 소각되며, 이리나가 건네는 간식을 알아보지 못한다.",
          hideConsequence: "서랍에 은닉됨. 이리나가 창구 너머에서 다정한 눈빛으로 미소 짓는다."
        }
      ]
    },

    {
      id: "ch3",
      day: 3,
      title: "제3일차: 공허의 망령들",
      quota: 500,
      background: "assets/bg/desk_404_dim.png",
      dialogues: [
        {
          speaker: "감찰관",
          expression: "stern",
          portrait: "assets/chars/inspector_stern.png",
          text: "404호, 최근 네 소각로 투입 기록에 미세한 누락이 보인다. 명심해라, 기억을 모두 소진한 퇴물들은 외곽의 '공허의 망령'이 될 뿐이다.",
          bgmMood: "tense"
        },
        {
          speaker: "이리나",
          expression: "sad",
          portrait: "assets/chars/irina_sad.png",
          text: "들었지? 밖을 배회하는 괴물들은 외계의 재앙이 아니야. 등대를 지키겠다며 자기 이름과 사랑하는 사람의 얼굴까지 남김없이 태워버린 이전 세대의 소각자들이야.",
          bgmMood: "melancholy"
        },
        {
          speaker: "이리나",
          expression: "neutral",
          portrait: "assets/chars/irina_neutral.png",
          text: "네가 태우는 결정들이 정말로 이 도시를 구하고 있는 걸까? 오늘치 서류철을 열어봐.",
          bgmMood: "work"
        }
      ],
      seizedMemories: [
        {
          id: "mem_301",
          owner: "소각과 전임자 #0399 (망령화 판정)",
          title: "딸에게 사주지 못한 오르골",
          grade: "A",
          previewText: "진열장 너머의 태엽 오르골. 이번 달 할당량만 채우면 꼭 사주겠다고 다짐했지만, 이젠 딸의 얼굴조차 흐릿하다.",
          calories: 250,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +250. 399호의 마지막 인간성이 소멸하여 외곽 구역에 망령 개체 수가 1 증가한다.",
          hideConsequence: "서랍에 은닉됨. 전임자 #0399가 남긴 등대 구조도 단서를 획득한다."
        },
        {
          id: "mem_302",
          owner: "시민 #7741 (거리의 악사)",
          title: "광장의 마지막 왈츠",
          grade: "A",
          previewText: "등대 불빛이 흔들리던 축제날 밤, 바이올린 현이 끊어질 때까지 연주하던 3박자의 선율.",
          calories: 250,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +250. 거리에서 음악 소리가 사라지고 배경음이 한층 먹먹해진다.",
          hideConsequence: "서랍에 은닉됨. 감찰관의 경고등이 켜진다.",
          burnEffects: { muffle: 0.15 } // [Claude] burnConsequence 의 '배경음이 한층 먹먹해진다' 를 실제 소리에 적용
        },
        {
          id: "mem_303",
          owner: "사번 #0404 (압류 등급: 극비)",
          title: "악몽을 재우던 자장가",
          grade: "S",
          previewText: "무릎을 베고 누운 내 이마를 쓸어내리며 이리나가 불러주던 자장가. '재가 내려도 눈을 감지 마, 아침은 하얀 눈으로 올 거야.'",
          calories: 300,
          isProtagonistMemory: true,
          redactKeyword: "자장가",
          burnConsequence: "할당량 +300. 수첩의 '자장가' 단어가 '███'로 소각되며, 게임 내 배경음악에 로우패스 필터가 영구 적용된다.",
          hideConsequence: "서랍에 은닉됨. 밤마다 꾸던 악몽 속에서 이리나의 목소리가 선명해진다."
        }
      ]
    },

    {
      id: "ch4",
      day: 4,
      title: "제4일차: 영사기의 방주",
      quota: 650,
      background: "assets/bg/desk_404_dim.png",
      dialogues: [
        {
          speaker: "이리나",
          expression: "glitch",
          portrait: "assets/chars/irina_glitch.png",
          text: "(이리나의 윤곽이 등대 불빛처럼 아른거린다) 이제 진실을 마주할 시간이야, 404호. 이 도시 '카르타'는 수백 년 전에 이미 멸망했어.",
          bgmMood: "truth"
        },
        {
          speaker: "이리나",
          expression: "sad",
          portrait: "assets/chars/irina_sad.png",
          text: "잿빛 등대는 방파제가 아니야. 태운 기억들을 허공에 쏘아 올려 망자들의 환영을 재생하는 거대한 영사기일 뿐이지. 백색 침묵은 재앙이 아니라, 환상이 걷히고 진짜 현실이 드러나는 현상이야.",
          bgmMood: "truth"
        },
        {
          speaker: "감찰관",
          expression: "stern",
          portrait: "assets/chars/inspector_stern.png",
          text: "404호! 누구와 혼잣말을 하는 거냐? 창구 앞에는 아무도 없다! 당장 오늘치 극비 압류품을 소각해라!",
          bgmMood: "tense"
        }
      ],
      seizedMemories: [
        {
          id: "mem_401",
          owner: "카르타 시청 기록보관소 (기밀)",
          title: "서기 2104년 대소멸 보고서",
          grade: "S",
          previewText: "생존자 0명. 자동 영사 시스템 '잿빛 등대' 가동 개시. 잔류 기억 데이터를 순환 연소하여 가상 도시 카르타의 외형을 유지함.",
          calories: 325,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +325. 세계의 진실이 담긴 기록이 다시 은폐된다.",
          hideConsequence: "서랍에 은닉됨. 도시가 거대한 홀로그램 방주라는 결정적 증거를 확보한다."
        },
        {
          id: "mem_402",
          owner: "감찰관 #0001 (본인 기억)",
          title: "첫 번째 루프의 선서",
          grade: "S",
          previewText: "설령 영원한 거짓말일지라도, 인류가 존재했다는 흔적을 허공에 남기기 위해 나는 기꺼이 감찰관의 가면을 쓴다.",
          calories: 325,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +325. 감찰관이 잠시 멍한 표정으로 자신의 명찰을 내려다본다.",
          hideConsequence: "서랍에 은닉됨. 감찰관의 약점을 쥔다."
        },
        {
          id: "mem_403",
          owner: "수감번호 #0404 (초기화 이전 기록)",
          title: "소각로 테러와 마지막 심문",
          grade: "S",
          previewText: "쇠사슬에 묶인 채 외치던 내 목소리. '죽은 자들의 기억을 착취해 가짜 연극을 돌리는 건 그만둬!' 그리고 강제로 씌워진 기억 추출 헬멧.",
          calories: 400,
          isProtagonistMemory: true,
          redactKeyword: "방화범",
          burnConsequence: "할당량 +400. 수첩의 '방화범' 기록이 '███'로 소각되며 체제에 저항하던 자신의 정체성을 완전히 잃는다.",
          hideConsequence: "서랍에 은닉됨. 자신이 수십 번이나 기억이 초기화된 채 등대를 부수려 했던 저항군이었음을 각성한다."
        }
      ]
    },

    {
      id: "ch5",
      day: 5,
      title: "제5일차: 404호 소각로의 선택",
      quota: 1000,
      background: "assets/bg/incinerator_core.png",
      dialogues: [
        {
          speaker: "이리나",
          expression: "smile",
          portrait: "assets/chars/irina_smile.png",
          text: "드디어 마지막 날이네. 맞혀볼래? 감찰관의 말대로 난 살아있는 사람이 아니야.",
          bgmMood: "climax"
        },
        {
          speaker: "이리나",
          expression: "sad",
          portrait: "assets/chars/irina_sad.png",
          text: "나는 네가 첫 번째 루프에서 기억을 강제로 압류당할 때, 끝까지 태우지 않고 심장 밑바닥에 숨겨뒀던 '죽은 연인에 대한 기억 그 자체'야. 등대 열기 속에서 자아를 얻어 매일 네 창구로 찾아왔던 거지.",
          bgmMood: "climax"
        },
        {
          speaker: "이리나",
          expression: "neutral",
          portrait: "assets/chars/irina_neutral.png",
          text: "이제 등대의 불꽃이 꺼져가. 날 소각로에 던져 넣으면 이 가짜 도시의 내일이 연장되고, 네 사번 '0404'를 투입해 과부하를 일으키면 이 영원한 루프가 끝나. 선택해 줘.",
          bgmMood: "climax"
        }
      ],
      seizedMemories: [
        {
          id: "mem_501",
          owner: "카르타 시민 전원 (집합 기억 코어)",
          title: "거짓된 평화의 내일",
          grade: "S",
          previewText: "매일 같은 아침 인사를 나누고, 같은 빵을 굽고, 자신이 죽은 줄도 모른 채 미소 짓는 백만 명의 환영.",
          calories: 500,
          isProtagonistMemory: false,
          redactKeyword: null,
          burnConsequence: "할당량 +500. 도시의 홀로그램 출력이 일시적으로 안정화된다.",
          hideConsequence: "서랍에 은닉됨. 도시 외곽의 홀로그램 건물들이 반투명하게 흩어지기 시작한다."
        },
        {
          id: "mem_502",
          owner: "사번 #0404 & 이리나 (최후의 코어)",
          title: "이리나와 함께한 이번 여정의 기억",
          grade: "SSR",
          previewText: "404호 데스크 창구 너머로 눈을 맞추던 순간들, 함께 나눈 온기, 그리고 설원에서 다시 만나자던 마지막 약속.",
          calories: 1000,
          isProtagonistMemory: true,
          redactKeyword: "약속",
          burnConsequence: "할당량 1000 달성. 수첩의 '약속'을 포함한 모든 글자가 소각되며 최종 타이핑 시퀀스(등대 점화)로 진입한다.",
          hideConsequence: "최후의 코어를 가슴에 품는다. 최종 타이핑 시퀀스(소각로 파괴 및 탈출)로 진입한다.",
          erasesNotebook: "all" // [Claude] burnConsequence 의 '모든 글자가 소각' 을 수첩 전체 소거로 구현
        }
      ]
    }
  ],

  endings: {
    inputPrompt: "소각로 최종 제어 단말기 활성화. 투입할 코어의 식별명(이리나 또는 0404)을 직접 타이핑하십시오.",
    burnIrina: {
      triggerKeywords: ["이리나", "irina", "IRINA"],
      title: "Ending A: 잿빛 영원 (부서진 녹음기)",
      background: "assets/bg/desk_404_normal.png",
      dialogues: [
        {
          speaker: "이리나",
          expression: "smile",
          portrait: "assets/chars/irina_smile.png",
          text: "고마워... 이번 생에서도 날 끝까지 기억해 줘서. 다음 루프에서 네가 날 다시 못 알아봐도, 내가 먼저 찾아갈게."
        },
        {
          speaker: "시스템",
          expression: "neutral",
          portrait: null,
          text: "[소각 완료] 등대 출력 100% 복구. 사번 #0404의 잔여 사적 기억을 초기화합니다."
        },
        {
          speaker: "감찰관",
          expression: "neutral",
          portrait: "assets/chars/inspector_neutral.png",
          text: "404호, 왜 눈물을 흘리고 있나? 자, 제1일차 정상 영업이다. 오늘치 압류품을 판독기에 올려라."
        }
      ]
    },
    destroyLighthouse: {
      triggerKeywords: ["0404", "#0404", "404"],
      title: "Ending B: 백색 침묵 너머의 진짜 아침",
      background: "assets/bg/white_silence_snowfield.png",
      dialogues: [
        {
          speaker: "시스템",
          expression: "neutral",
          portrait: null,
          text: "[치명적 오류] 관리자 사번 #0404 코어 역투입 감지. 잿빛 등대 영사기가 영구 정지됩니다."
        },
        {
          speaker: "이리나",
          expression: "smile",
          portrait: "assets/chars/irina_smile.png",
          text: "봐, 거짓말 같던 건물들이 안개처럼 평화롭게 흩어지고 있어. 이제 아무것도 태우지 않아도 돼."
        },
        {
          speaker: "이리나",
          expression: "smile",
          portrait: "assets/chars/irina_smile.png",
          text: "내 손 꽉 잡아, 404호... 아니, 내 소중한 사람. 아무것도 남지 않은 이 새하얀 설원 위를 이제 우리 둘만의 진짜 기억으로 채우러 가자."
        }
      ]
    },
    quotaFailure: {
      triggerKeywords: [],
      title: "Ending C: 직무 유기 및 재압류",
      background: "assets/bg/desk_404_dim.png",
      dialogues: [
        {
          speaker: "감찰관",
          expression: "stern",
          portrait: "assets/chars/inspector_stern.png",
          text: "할당량 미달에 기억 은닉까지... 아직도 버릇을 못 고쳤군, 404호. 강제 초기화 처분을 집행한다."
        }
      ]
    }
  }
};
