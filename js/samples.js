/* Built-in reviewers Cody ships with, so the app works on day one, offline and without an AI key.
   Each one has the same shape an AI-made reviewer has (see lib/tasks.js):
     terms, questions, quiz, cards and a drawing spec.
   Drawing specs use a 400 x 300 picture. Each part is one step: its shapes, a label, an anchor point
   on the part (where the label points and where Label it! puts its drop spot) and what Cody says. */

const C = { teal: '#2dd4bf', yellow: '#fbbf24', pink: '#f7687f', blue: '#60a5fa', green: '#4ade80', purple: '#a78bfa', orange: '#fb923c', white: '#e2e8f0', slate: '#64748b' };

const heartDrawing = {
  title: 'The human heart',
  parts: [
    { id: 'ra', label: 'Right atrium', color: C.blue, anchor: [150, 140],
      say: 'The right atrium is the top chamber on the right side. Blood that has used up its oxygen comes back here from the body.',
      shapes: [{ t: 'path', d: 'M 120 125 Q 150 102 196 104 M 124 140 Q 128 118 150 118 Q 176 118 176 140 Q 176 162 150 162 Q 126 162 124 140 Z' }] },
    { id: 'vc', label: 'Vena cava', color: C.blue, anchor: [140, 78],
      say: 'The vena cava is the big vein that brings that blood back from the body into the right atrium.',
      shapes: [{ t: 'path', d: 'M 136 40 L 136 120 M 146 40 L 146 118' }] },
    { id: 'rv', label: 'Right ventricle', color: C.blue, anchor: [156, 205],
      say: 'The right ventricle is the bottom chamber on the right. It pumps blood to the lungs to pick up oxygen.',
      shapes: [{ t: 'path', d: 'M 126 172 L 184 172 Q 182 222 180 254 Q 146 222 126 172 Z' }] },
    { id: 'pa', label: 'Pulmonary artery', color: C.blue, anchor: [166, 80],
      say: 'The pulmonary artery carries that blood from the right ventricle to the lungs.',
      shapes: [{ t: 'path', d: 'M 178 106 Q 176 74 158 52 M 188 104 Q 188 70 172 46' }] },
    { id: 'la', label: 'Left atrium', color: C.pink, anchor: [238, 138],
      say: 'The left atrium is the top chamber on the left side. Fresh, oxygen rich blood comes back here from the lungs.',
      shapes: [{ t: 'path', d: 'M 208 138 Q 208 120 238 120 Q 266 120 266 138 Q 266 156 238 156 Q 208 156 208 138 Z' }] },
    { id: 'lv', label: 'Left ventricle', color: C.pink, anchor: [232, 200],
      say: 'The left ventricle is the strongest chamber. It pumps blood to the whole body, so its wall is the thickest.',
      shapes: [{ t: 'path', d: 'M 204 168 L 268 168 Q 258 214 205 258 Q 208 212 204 168 Z', sw: 4.5 }] },
    { id: 'ao', label: 'Aorta', color: C.pink, anchor: [246, 56],
      say: 'The aorta is the biggest artery. It carries oxygen rich blood from the left ventricle out to the whole body.',
      shapes: [{ t: 'path', d: 'M 206 104 Q 204 54 244 54 Q 282 54 282 96 M 220 104 Q 220 68 244 68 Q 268 68 268 96' }] },
    { id: 'sep', label: 'Septum', color: C.pink, anchor: [197, 196],
      say: 'The septum is the wall down the middle. It keeps the left and right sides apart so the blood does not mix.',
      shapes: [{ t: 'path', d: 'M 196 106 Q 202 190 192 272', dash: true }] },
    { id: 'valves', label: 'Valves', color: C.yellow, anchor: [150, 167],
      say: 'Valves are flaps between the chambers. They open to let blood through, then close so it cannot flow back.',
      shapes: [{ t: 'path', d: 'M 136 166 L 150 172 L 164 166 M 214 162 L 232 168 L 250 162' }] },
    { id: 'wall', label: 'Heart wall', color: C.pink, anchor: [276, 150],
      say: 'All of this sits inside one strong muscle. Its point at the bottom is called the apex.',
      shapes: [{ t: 'path', d: 'M 196 104 Q 262 102 278 140 Q 288 186 252 226 Q 226 254 194 280 Q 160 252 134 216 Q 108 176 120 125' }] },
  ],
};

const waterDrawing = {
  title: 'The water cycle',
  parts: [
    { id: 'sun', label: 'Sun', color: C.yellow, anchor: [78, 72],
      say: 'The sun heats water in seas, rivers and lakes.',
      shapes: [{ t: 'circle', cx: 78, cy: 72, r: 24 },
        { t: 'path', d: 'M 78 30 L 78 40 M 78 104 L 78 114 M 36 72 L 46 72 M 110 72 L 120 72 M 48 42 L 55 49 M 101 95 L 108 102 M 48 102 L 55 95 M 101 49 L 108 42' }] },
    { id: 'sea', label: 'Sea', color: C.blue, anchor: [120, 258],
      say: 'Most of the water on Earth is in the sea. This is where the cycle starts.',
      shapes: [{ t: 'path', d: 'M 20 252 Q 60 246 100 252 T 180 252 T 260 252' }, { t: 'path', d: 'M 20 268 Q 60 262 100 268 T 180 268', sw: 2 }] },
    { id: 'evap', label: 'Evaporation', color: C.teal, anchor: [150, 196],
      say: 'Evaporation: the warm water rises into the air as invisible vapour.',
      shapes: [{ t: 'arrow', d: 'M 140 240 Q 130 210 140 180 Q 150 150 140 130' }, { t: 'arrow', d: 'M 172 240 Q 162 210 172 180 Q 182 150 172 130' }] },
    { id: 'cond', label: 'Condensation', color: C.white, anchor: [262, 82],
      say: 'Condensation: high up, the vapour cools and turns into tiny drops that make clouds.',
      shapes: [{ t: 'path', d: 'M 218 110 Q 200 110 202 94 Q 204 78 222 80 Q 226 58 250 60 Q 270 50 284 70 Q 306 66 310 86 Q 322 102 304 110 Z' }] },
    { id: 'rain', label: 'Precipitation', color: C.blue, anchor: [262, 150],
      say: 'Precipitation: when the drops get heavy, the water falls back down as rain.',
      shapes: [{ t: 'path', d: 'M 236 124 L 228 146 M 256 124 L 248 146 M 276 124 L 268 146 M 296 124 L 288 146 M 246 158 L 238 180 M 266 158 L 258 180 M 286 158 L 278 180' }] },
    { id: 'collect', label: 'Collection', color: C.green, anchor: [338, 214],
      say: 'Collection: rain runs down hills into rivers and back to the sea, and the cycle starts again.',
      shapes: [{ t: 'path', d: 'M 270 250 L 330 172 L 392 250' }, { t: 'arrow', d: 'M 352 212 Q 330 236 300 246 Q 280 250 262 250' }] },
  ],
};

const photoDrawing = {
  title: 'Photosynthesis',
  parts: [
    { id: 'sun', label: 'Sunlight', color: C.yellow, anchor: [58, 54],
      say: 'Plants use energy from sunlight to make their own food.',
      shapes: [{ t: 'circle', cx: 58, cy: 54, r: 20 }, { t: 'arrow', d: 'M 86 74 L 150 112' }, { t: 'arrow', d: 'M 74 88 L 130 136' }] },
    { id: 'leaf', label: 'Leaf', color: C.green, anchor: [214, 150],
      say: 'It happens in the leaf. The leaf is green because of chlorophyll, which catches the light.',
      shapes: [{ t: 'path', d: 'M 132 160 Q 180 82 290 110 Q 268 196 160 190 Q 140 186 132 160 Z' }, { t: 'path', d: 'M 132 160 Q 210 150 290 110 M 180 156 L 196 128 M 214 148 L 236 118 M 248 136 L 262 116 M 190 154 L 202 178 M 228 144 L 246 174' }] },
    { id: 'chloro', label: 'Chloroplast', color: C.teal, anchor: [204, 112],
      say: 'Inside each leaf cell are chloroplasts. They hold the chlorophyll and are where the food is made.',
      shapes: [{ t: 'ellipse', cx: 204, cy: 112, rx: 14, ry: 8 }, { t: 'path', d: 'M 194 112 L 214 112 M 198 108 L 210 108 M 198 116 L 210 116' }] },
    { id: 'co2', label: 'Carbon dioxide', color: C.white, anchor: [60, 170],
      say: 'Carbon dioxide from the air goes in through tiny holes under the leaf called stomata.',
      shapes: [{ t: 'arrow', d: 'M 40 170 L 128 166' }, { t: 'text', x: 44, y: 160, text: 'CO2' }] },
    { id: 'water', label: 'Water', color: C.blue, anchor: [190, 250],
      say: 'Water comes up from the roots, through the stem, into the leaf.',
      shapes: [{ t: 'path', d: 'M 170 190 Q 178 230 176 280', sw: 4 }, { t: 'path', d: 'M 176 268 L 150 290 M 176 268 L 204 290 M 176 280 L 176 296' }, { t: 'arrow', d: 'M 196 288 L 196 214' }, { t: 'text', x: 202, y: 262, text: 'H2O' }] },
    { id: 'o2', label: 'Oxygen', color: C.teal, anchor: [330, 108],
      say: 'The plant gives off oxygen into the air. That is the oxygen we breathe.',
      shapes: [{ t: 'arrow', d: 'M 296 116 L 370 92' }, { t: 'text', x: 338, y: 84, text: 'O2' }] },
    { id: 'sugar', label: 'Glucose', color: C.orange, anchor: [300, 190],
      say: 'The food it makes is glucose, a sugar. The plant uses it for energy and to grow.',
      shapes: [{ t: 'arrow', d: 'M 252 176 L 330 210' }, { t: 'text', x: 316, y: 230, text: 'sugar' }] },
  ],
};

const cellDrawing = {
  title: 'The plant cell',
  parts: [
    { id: 'wall', label: 'Cell wall', color: C.green, anchor: [72, 150],
      say: 'The cell wall is the stiff outer layer. It gives the plant cell its box shape and keeps it strong.',
      shapes: [{ t: 'rect', x: 70, y: 30, width: 260, height: 240, rx: 18, sw: 5 }] },
    { id: 'mem', label: 'Cell membrane', color: C.teal, anchor: [82, 60],
      say: 'Just inside the wall is the cell membrane. It controls what goes in and out of the cell.',
      shapes: [{ t: 'rect', x: 80, y: 40, width: 240, height: 220, rx: 14, dash: true }] },
    { id: 'vac', label: 'Vacuole', color: C.blue, anchor: [232, 170],
      say: 'The big vacuole is a sac of water. It pushes out on the wall and keeps the plant firm.',
      shapes: [{ t: 'path', d: 'M 180 120 Q 186 92 230 96 Q 290 98 292 150 Q 296 222 236 230 Q 186 232 182 190 Q 178 160 180 120 Z' }] },
    { id: 'nuc', label: 'Nucleus', color: C.purple, anchor: [128, 96],
      say: 'The nucleus is the control centre. It holds the DNA, the instructions for the whole cell.',
      shapes: [{ t: 'circle', cx: 128, cy: 96, r: 24 }, { t: 'circle', cx: 132, cy: 92, r: 7 }] },
    { id: 'chl', label: 'Chloroplast', color: C.green, anchor: [120, 214],
      say: 'Chloroplasts are where photosynthesis happens. Animal cells do not have these.',
      shapes: [{ t: 'ellipse', cx: 120, cy: 214, rx: 20, ry: 10 }, { t: 'path', d: 'M 106 214 L 134 214 M 110 209 L 130 209 M 110 219 L 130 219' }, { t: 'ellipse', cx: 158, cy: 246, rx: 16, ry: 8 }] },
    { id: 'mito', label: 'Mitochondrion', color: C.orange, anchor: [130, 156],
      say: 'Mitochondria release energy from food. They are the power stations of the cell.',
      shapes: [{ t: 'ellipse', cx: 130, cy: 156, rx: 22, ry: 11 }, { t: 'path', d: 'M 112 156 Q 118 148 124 158 Q 130 166 136 154 Q 142 146 148 156' }] },
    { id: 'cyto', label: 'Cytoplasm', color: C.slate, anchor: [270, 64],
      say: 'Cytoplasm is the jelly that fills the cell. Everything else floats in it.',
      shapes: [{ t: 'path', d: 'M 250 60 L 252 62 M 280 70 L 282 72 M 300 56 L 302 58 M 262 80 L 264 82 M 100 130 L 102 132 M 160 60 L 162 62 M 300 246 L 302 248' , sw: 3 }] },
  ],
};

export const SAMPLES = [
  {
    id: 'sample-heart', subject: 'Biology', title: 'The human heart', source: { name: 'Bio_Chapter5_Heart.pdf', pages: 8 }, seconds: 12,
    terms: [
      { term: 'Atria', meaning: 'The two top chambers. They receive blood coming back to the heart.', part: 'ra' },
      { term: 'Ventricles', meaning: 'The two bottom chambers. They pump blood out to the lungs and body.', part: 'lv' },
      { term: 'Aorta', meaning: 'The biggest artery. It carries oxygen rich blood to the whole body.', part: 'ao' },
      { term: 'Valves', meaning: 'Flaps that keep blood flowing one way.', part: 'valves' },
      { term: 'Septum', meaning: 'The wall between the left and right sides.', part: 'sep' },
      { term: 'Vena cava', meaning: 'The large vein that brings used blood from the body back to the heart.', part: 'vc' },
    ],
    questions: ['Which chamber pumps blood to the whole body?', 'What keeps blood from flowing backwards?', "Label the four chambers on Cody's drawing."],
    quiz: [
      { q: 'Which chamber pumps blood to the whole body?', choices: ['Right atrium', 'Left ventricle', 'Right ventricle', 'Left atrium'], a: 1, why: 'The left ventricle pumps blood out through the aorta to the whole body. That is why its wall is the thickest.', part: 'lv' },
      { q: 'Where does blood from the body enter the heart?', choices: ['Left atrium', 'Aorta', 'Right atrium', 'Left ventricle'], a: 2, why: 'Used blood comes back through the vena cava into the right atrium.', part: 'ra' },
      { q: 'What does the septum do?', choices: ['Pumps blood', 'Separates the left and right sides', 'Carries blood to the lungs', 'Stores oxygen'], a: 1, why: 'The septum is a wall that keeps oxygen rich and oxygen poor blood from mixing.', part: 'sep' },
      { q: 'Which part keeps blood from flowing backwards in the heart?', choices: ['The septum', 'The valves', 'The aorta', 'The atria'], a: 1, why: "Valves are flaps between the chambers. They open to let blood through, then close so it can't flow back.", part: 'valves' },
      { q: 'Where does the right ventricle send blood?', choices: ['To the whole body', 'To the brain only', 'To the lungs', 'To the left atrium directly'], a: 2, why: 'The right ventricle pumps oxygen poor blood through the pulmonary artery to the lungs.', part: 'pa' },
      { q: 'What is the biggest artery in the body?', choices: ['Vena cava', 'Pulmonary artery', 'Aorta', 'Septum'], a: 2, why: 'The aorta leaves the left ventricle and carries oxygen rich blood to the whole body.', part: 'ao' },
      { q: 'How many chambers does the human heart have?', choices: ['Two', 'Three', 'Four', 'Six'], a: 2, why: 'Two atria on top and two ventricles below: four chambers.', part: 'rv' },
      { q: 'Blood in the left atrium has just come from…', choices: ['The lungs', 'The body', 'The right ventricle', 'The stomach'], a: 0, why: 'Oxygen rich blood comes back from the lungs into the left atrium.', part: 'la' },
      { q: 'Why is the left ventricle wall the thickest?', choices: ['It holds the most blood', 'It pumps blood the farthest, to the whole body', 'It protects the septum', 'It is the oldest part'], a: 1, why: 'It has to push blood all around the body, so it needs the most muscle.', part: 'lv' },
      { q: 'Which vessel brings used blood back from the body?', choices: ['Aorta', 'Vena cava', 'Pulmonary artery', 'Capillary'], a: 1, why: 'The vena cava is the big vein that returns blood to the right atrium.', part: 'vc' },
    ],
    cards: [
      { front: 'Septum', back: 'The wall between the left and right sides of the heart. It keeps the blood from mixing.', part: 'sep' },
      { front: 'Atria', back: 'The two top chambers. They receive blood coming back to the heart.', part: 'ra' },
      { front: 'Ventricles', back: 'The two bottom chambers. They pump blood out to the lungs and body.', part: 'lv' },
      { front: 'Aorta', back: 'The biggest artery. It carries oxygen rich blood to the whole body.', part: 'ao' },
      { front: 'Valves', back: 'Flaps that keep blood flowing one way.', part: 'valves' },
      { front: 'Vena cava', back: 'The large vein that brings used blood back to the right atrium.', part: 'vc' },
      { front: 'Pulmonary artery', back: 'Carries oxygen poor blood from the right ventricle to the lungs.', part: 'pa' },
      { front: 'Left ventricle', back: 'Pumps blood to the whole body; it has the thickest wall.', part: 'lv' },
      { front: 'Right ventricle', back: 'Pumps blood to the lungs.', part: 'rv' },
      { front: 'Right atrium', back: 'Receives used blood from the body.', part: 'ra' },
      { front: 'Left atrium', back: 'Receives fresh, oxygen rich blood from the lungs.', part: 'la' },
      { front: 'Apex', back: 'The pointed bottom tip of the heart.', part: 'wall' },
    ],
    drawing: heartDrawing,
    game: ['ra', 'la', 'rv', 'lv', 'sep', 'ao'],
  },
  {
    id: 'sample-water', subject: 'Science', title: 'The water cycle', source: { name: 'Sci_Unit2_Water.pdf', pages: 4 }, seconds: 9,
    terms: [
      { term: 'Evaporation', meaning: 'Water heated by the sun turns into vapour and rises.', part: 'evap' },
      { term: 'Condensation', meaning: 'Vapour cools high up and turns into drops that form clouds.', part: 'cond' },
      { term: 'Precipitation', meaning: 'Water falling from clouds as rain, snow or hail.', part: 'rain' },
      { term: 'Collection', meaning: 'Water gathering in rivers, lakes and seas.', part: 'collect' },
    ],
    questions: ['What makes water evaporate?', 'What forms when vapour cools?', 'Name the four stages in order.'],
    quiz: [
      { q: 'What gives the water cycle its energy?', choices: ['The moon', 'The sun', 'The wind', 'The ocean floor'], a: 1, why: 'The sun heats the water, which makes it evaporate.', part: 'sun' },
      { q: 'What is condensation?', choices: ['Water falling as rain', 'Vapour cooling into drops', 'Water soaking into soil', 'Ice melting'], a: 1, why: 'High up, vapour cools and turns into the tiny drops that make clouds.', part: 'cond' },
      { q: 'Rain, snow and hail are all forms of…', choices: ['Evaporation', 'Condensation', 'Precipitation', 'Collection'], a: 2, why: 'Any water that falls from clouds is precipitation.', part: 'rain' },
      { q: 'Which comes right after evaporation?', choices: ['Collection', 'Precipitation', 'Condensation', 'Runoff'], a: 2, why: 'The vapour rises, cools and condenses into clouds.', part: 'cond' },
      { q: 'Where does most of Earth’s water collect?', choices: ['Clouds', 'Rivers', 'Oceans and seas', 'Underground caves'], a: 2, why: 'Most water collects in the oceans, where the cycle starts again.', part: 'sea' },
    ],
    cards: [
      { front: 'Evaporation', back: 'Water turns into vapour and rises.', part: 'evap' },
      { front: 'Condensation', back: 'Vapour cools into drops and forms clouds.', part: 'cond' },
      { front: 'Precipitation', back: 'Water falls from clouds as rain, snow or hail.', part: 'rain' },
      { front: 'Collection', back: 'Water gathers in rivers, lakes and seas.', part: 'collect' },
    ],
    drawing: waterDrawing,
    game: ['sun', 'evap', 'cond', 'rain', 'collect'],
  },
  {
    id: 'sample-photo', subject: 'Biology', title: 'Photosynthesis', source: { name: 'Bio_Chapter3_Plants.pdf', pages: 6 }, seconds: 10,
    terms: [
      { term: 'Photosynthesis', meaning: 'How plants make food (glucose) from light, water and carbon dioxide.', part: 'leaf' },
      { term: 'Chlorophyll', meaning: 'The green pigment that catches sunlight.', part: 'chloro' },
      { term: 'Stomata', meaning: 'Tiny holes in the leaf that let gases in and out.', part: 'co2' },
      { term: 'Glucose', meaning: 'The sugar the plant makes and uses for energy.', part: 'sugar' },
    ],
    questions: ['What three things does a plant need for photosynthesis?', 'What gas do plants give off?', 'Where in the cell does it happen?'],
    quiz: [
      { q: 'Which gas do plants take in for photosynthesis?', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], a: 2, why: 'Carbon dioxide goes in through the stomata.', part: 'co2' },
      { q: 'Which gas do plants give off?', choices: ['Oxygen', 'Carbon dioxide', 'Methane', 'Hydrogen'], a: 0, why: 'Oxygen is released, and that is the oxygen we breathe.', part: 'o2' },
      { q: 'Where does photosynthesis happen?', choices: ['Mitochondria', 'Chloroplasts', 'Nucleus', 'Vacuole'], a: 1, why: 'Chloroplasts hold the chlorophyll that catches light.', part: 'chloro' },
      { q: 'What food does photosynthesis make?', choices: ['Protein', 'Fat', 'Glucose', 'Salt'], a: 2, why: 'Plants make glucose, a sugar, for energy.', part: 'sugar' },
      { q: 'How does water reach the leaf?', choices: ['Through the stomata', 'Up from the roots through the stem', 'From the air', 'From the flowers'], a: 1, why: 'Roots take in water and the stem carries it up.', part: 'water' },
    ],
    cards: [
      { front: 'Chlorophyll', back: 'Green pigment that catches sunlight.', part: 'chloro' },
      { front: 'Stomata', back: 'Tiny holes that let gases in and out of the leaf.', part: 'co2' },
      { front: 'Glucose', back: 'The sugar a plant makes.', part: 'sugar' },
      { front: 'Products of photosynthesis', back: 'Glucose and oxygen.', part: 'o2' },
      { front: 'Needs of photosynthesis', back: 'Light, water and carbon dioxide.', part: 'sun' },
    ],
    drawing: photoDrawing,
    game: ['sun', 'leaf', 'co2', 'water', 'o2', 'sugar'],
  },
  {
    id: 'sample-cell', subject: 'Biology', title: 'Plant cell', source: { name: 'Bio_Chapter2_Cells.pdf', pages: 5 }, seconds: 11,
    terms: [
      { term: 'Cell wall', meaning: 'Stiff outer layer that gives a plant cell its shape.', part: 'wall' },
      { term: 'Nucleus', meaning: 'Control centre that holds the DNA.', part: 'nuc' },
      { term: 'Vacuole', meaning: 'Large sac of water that keeps the cell firm.', part: 'vac' },
      { term: 'Chloroplast', meaning: 'Where photosynthesis happens.', part: 'chl' },
      { term: 'Mitochondrion', meaning: 'Releases energy from food.', part: 'mito' },
    ],
    questions: ['Which parts does a plant cell have that an animal cell does not?', 'What does the nucleus do?', 'Why is the vacuole so big?'],
    quiz: [
      { q: 'Which part controls the cell?', choices: ['Vacuole', 'Nucleus', 'Cell wall', 'Cytoplasm'], a: 1, why: 'The nucleus holds the DNA, the instructions for the cell.', part: 'nuc' },
      { q: 'Which part do plant cells have but animal cells do not?', choices: ['Nucleus', 'Cell membrane', 'Chloroplast', 'Mitochondrion'], a: 2, why: 'Only plant cells have chloroplasts (and a cell wall).', part: 'chl' },
      { q: 'What is the job of the mitochondrion?', choices: ['Make food', 'Release energy', 'Store water', 'Control the cell'], a: 1, why: 'Mitochondria release energy from glucose.', part: 'mito' },
      { q: 'What keeps a plant cell firm?', choices: ['The large vacuole', 'The nucleus', 'Ribosomes', 'Cytoplasm'], a: 0, why: 'The water-filled vacuole pushes out against the wall.', part: 'vac' },
    ],
    cards: [
      { front: 'Cell wall', back: 'Stiff outer layer; gives the cell its shape.', part: 'wall' },
      { front: 'Nucleus', back: 'Holds the DNA; controls the cell.', part: 'nuc' },
      { front: 'Vacuole', back: 'Large sac of water; keeps the cell firm.', part: 'vac' },
    ],
    drawing: cellDrawing,
    game: ['wall', 'nuc', 'vac', 'chl', 'mito', 'mem'],
  },
];

// Ask "how does the water cycle work?" and Cody can draw it at once, offline.
export function sampleFor(text) {
  const t = String(text || '').toLowerCase();
  if (/heart|puso|atri|ventric|aorta/.test(t)) return SAMPLES[0];
  if (/water cycle|hydrolog|evaporat|condens|precipit|siklo ng tubig/.test(t)) return SAMPLES[1];
  if (/photosynth|chlorophyll|potosintesis/.test(t)) return SAMPLES[2];
  if (/plant cell|cell wall|organelle|chloroplast|vacuole/.test(t)) return SAMPLES[3];
  return null;
}
