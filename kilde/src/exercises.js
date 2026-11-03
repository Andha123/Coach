/* Øvelsesbank: vanlige styrkeøvelser med navnet de fleste bruker på treningssenteret (engelsk), norske navn og
 * andre skrivemåter som søkeord, og muskelgruppe. «*» = vanlig grunnøvelse som foreslås når du velger økt. */
(function (root) {
  'use strict';
  var G = {
    bryst: 'Bryst', rygg: 'Rygg', skuldre: 'Skuldre', biceps: 'Biceps', triceps: 'Triceps', forside: 'Forside lår',
    bakside: 'Bakside og sete', legger: 'Legger', mage: 'Mage og kjerne', trapes: 'Trapes og underarm', hel: 'Helkropp'
  };
  var L = [
    // Bryst
    ['*Bench press', 'benkpress, flat benk, bench, stangbenk', 'bryst'],
    ['*Incline bench press', 'skråbenk, skråbenkpress, incline bench, incline bech', 'bryst'],
    ['Decline bench press', 'nedoverskrå benkpress, decline bench', 'bryst'],
    ['*Dumbbell bench press', 'benkpress manualer, manualpress, db bench, dumbell press', 'bryst'],
    ['*Incline dumbbell press', 'skrå manualpress, incline db press, incline dumbell press', 'bryst'],
    ['Decline dumbbell press', 'nedoverskrå manualpress', 'bryst'],
    ['Smith machine bench press', 'smith benk, smith bench', 'bryst'],
    ['*Smith machine incline press', 'incline smith, skrå smith, incline bench smith', 'bryst'],
    ['Machine chest press', 'brystpress maskin, chest press', 'bryst'],
    ['Incline machine press', 'skrå brystpress maskin', 'bryst'],
    ['*Cable fly', 'kabelflyes, cable flyes, cabel fly, crossover', 'bryst'],
    ['Low-to-high cable fly', 'incline cable fly, incline cabel fly, kabelflyes nedenfra', 'bryst'],
    ['High-to-low cable fly', 'decline cable fly, decline cabel fly, decline cable press, decline cabel press, kabelflyes ovenfra', 'bryst'],
    ['Dumbbell fly', 'flyes manualer, dumbell fly', 'bryst'],
    ['Incline dumbbell fly', 'skrå flyes', 'bryst'],
    ['Pec deck', 'butterfly, pec fly, brystmaskin', 'bryst'],
    ['Push-up', 'armhevinger, pushups', 'bryst'],
    ['Weighted push-up', 'armhevinger med vekt', 'bryst'],
    ['Chest dips', 'dips bryst', 'bryst'],
    ['Floor press', 'gulvpress', 'bryst'],
    ['Landmine press', 'landmine', 'bryst'],
    ['Svend press', 'plate press', 'bryst'],
    // Skuldre
    ['*Overhead press', 'militærpress, skulderpress stang, ohp, military press, stående skulderpress', 'skuldre'],
    ['*Seated dumbbell shoulder press', 'skulderpress manualer, shoulder press, db shoulder press', 'skuldre'],
    ['Arnold press', 'arnoldpress', 'skuldre'],
    ['Machine shoulder press', 'skulderpress maskin', 'skuldre'],
    ['Smith machine shoulder press', 'smith skulderpress', 'skuldre'],
    ['Push press', 'pushpress', 'skuldre'],
    ['*Lateral raise', 'sidehev, side delts, side raise, lateral raises', 'skuldre'],
    ['Cable lateral raise', 'sidehev kabel', 'skuldre'],
    ['Machine lateral raise', 'sidehev maskin', 'skuldre'],
    ['Front raise', 'fronthev', 'skuldre'],
    ['*Rear delt fly', 'omvendt flyes, rear delts, bakre skulder, reverse fly', 'skuldre'],
    ['Reverse pec deck', 'omvendt butterfly, rear delt machine', 'skuldre'],
    ['*Face pull', 'facepull, face pulls', 'skuldre'],
    ['Upright row', 'stående roing, opptrekk stående', 'skuldre'],
    ['Cable Y-raise', 'y raise', 'skuldre'],
    // Triceps
    ['*Triceps pushdown', 'tricepspress kabel, pushdown, triceps nedpress, tricep pushdown', 'triceps'],
    ['Rope pushdown', 'tau pushdown, rope triceps', 'triceps'],
    ['*Overhead cable triceps extension', 'triceps over hodet kabel, overhead extension', 'triceps'],
    ['Skull crusher', 'fransk press, french press, liggende triceps', 'triceps'],
    ['Overhead dumbbell extension', 'triceps over hodet manual', 'triceps'],
    ['Close-grip bench press', 'smal benkpress, smalbenk, cgbp', 'triceps'],
    ['*Dips', 'dips, parallell dips, tricep dips', 'triceps'],
    ['Bench dips', 'benkdips', 'triceps'],
    ['Triceps kickback', 'kickback', 'triceps'],
    ['JM press', 'jm', 'triceps'],
    ['Machine dips', 'dips maskin, assisted dips', 'triceps'],
    // Rygg
    ['*Deadlift', 'markløft, mark, konvensjonell markløft', 'rygg'],
    ['*Pull-up', 'pullups, pull ups, chins, opptrekk', 'rygg'],
    ['Chin-up', 'chinups, underhåndsgrep opptrekk', 'rygg'],
    ['*Lat pulldown', 'nedtrekk, pulldown, lat pull', 'rygg'],
    ['Close-grip lat pulldown', 'smal nedtrekk, pulldown biceps, v grip pulldown', 'rygg'],
    ['Single-arm lat pulldown', 'enarms nedtrekk', 'rygg'],
    ['Straight-arm pulldown', 'strak arm nedtrekk, pullover kabel', 'rygg'],
    ['*Barbell row', 'roing stang, bent over row, foroverbøyd roing', 'rygg'],
    ['Pendlay row', 'pendlay', 'rygg'],
    ['*Dumbbell row', 'enarms roing, manualroing, one arm row, db row', 'rygg'],
    ['*Seated cable row', 'sittende roing, cable row, rows, roing kabel', 'rygg'],
    ['Chest-supported row', 'brystsupportert roing, supported rows, incline row', 'rygg'],
    ['T-bar row', 't bar', 'rygg'],
    ['Machine row', 'roing maskin, hammer row', 'rygg'],
    ['Seal row', 'seal', 'rygg'],
    ['Rack pull', 'rackpull', 'rygg'],
    ['Back extension', 'rygghev, hyperextension, hyperextensions', 'rygg'],
    ['Good morning', 'good mornings', 'rygg'],
    ['Inverted row', 'australske pullups, kroppsroing', 'rygg'],
    // Biceps
    ['*Barbell curl', 'bicepscurl stang, stangcurl, biceps curl', 'biceps'],
    ['*Dumbbell curl', 'bicepscurl manualer, manualcurl, biceps curls', 'biceps'],
    ['EZ-bar curl', 'ez curl, ez stang', 'biceps'],
    ['*Hammer curl', 'hammercurl, hammer curls', 'biceps'],
    ['Incline dumbbell curl', 'skrå curl, incline curl', 'biceps'],
    ['Preacher curl', 'scottcurl, scott curl', 'biceps'],
    ['Cable curl', 'curl kabel', 'biceps'],
    ['Bayesian cable curl', 'bayesian curl', 'biceps'],
    ['Concentration curl', 'konsentrasjonscurl', 'biceps'],
    ['Spider curl', 'spidercurl', 'biceps'],
    ['Machine curl', 'curl maskin', 'biceps'],
    ['Standing dumbbell curl', 'stående biceps curls, stående curls', 'biceps'],
    // Forside lår
    ['*Back squat', 'knebøy, squat, stangknebøy', 'forside'],
    ['Front squat', 'frontbøy, front knebøy', 'forside'],
    ['Goblet squat', 'goblet', 'forside'],
    ['*Hack squat', 'hacksquat, hack knebøy', 'forside'],
    ['Smith machine squat', 'smith knebøy', 'forside'],
    ['*Leg press', 'beinpress, benpress', 'forside'],
    ['*Bulgarian split squat', 'bulgarsk utfall, bss, bulgarian', 'forside'],
    ['Walking lunge', 'gående utfall, utfall, lunges', 'forside'],
    ['Reverse lunge', 'utfall bakover', 'forside'],
    ['Step-up', 'stepup, steg opp', 'forside'],
    ['*Leg extension', 'beinspark, leg extensions, lårspark', 'forside'],
    ['Pendulum squat', 'pendulum', 'forside'],
    ['Belt squat', 'beltsquat', 'forside'],
    ['Sissy squat', 'sissy', 'forside'],
    // Bakside og sete
    ['*Romanian deadlift', 'rumensk markløft, rdl, strak markløft', 'bakside'],
    ['Stiff-leg deadlift', 'stivbeint markløft, sldl', 'bakside'],
    ['Sumo deadlift', 'sumo markløft, sumo', 'bakside'],
    ['Trap bar deadlift', 'hexbar markløft, trap bar', 'bakside'],
    ['*Lying leg curl', 'liggende lårcurl, leg curl, hamstring curl', 'bakside'],
    ['*Seated leg curl', 'sittende lårcurl', 'bakside'],
    ['Nordic curl', 'nordic hamstring, nordics', 'bakside'],
    ['*Hip thrust', 'hoftehev, hip thrusts, glute thrust', 'bakside'],
    ['Glute bridge', 'setehev, glute bridge', 'bakside'],
    ['Cable kickback', 'setekick kabel, glute kickback', 'bakside'],
    ['Hip abduction', 'abduktor, abduction maskin', 'bakside'],
    ['Hip adduction', 'adduktor, adduction maskin', 'bakside'],
    ['Single-leg Romanian deadlift', 'ettbeins markløft, single leg rdl', 'bakside'],
    ['Kettlebell swing', 'kettlebell sving, kb swing', 'bakside'],
    // Legger
    ['*Standing calf raise', 'tåhev stående, calf raise, leggløft', 'legger'],
    ['Seated calf raise', 'tåhev sittende', 'legger'],
    ['Leg press calf raise', 'tåhev beinpress', 'legger'],
    // Mage og kjerne
    ['*Plank', 'planke', 'mage'],
    ['*Hanging leg raise', 'hengende beinhev, leg raise', 'mage'],
    ['*Cable crunch', 'kabelcrunch, crunch kabel', 'mage'],
    ['Ab wheel rollout', 'magehjul, ab wheel, rollout', 'mage'],
    ['Crunch', 'situps, sit ups, magebøy', 'mage'],
    ['Russian twist', 'russisk vri', 'mage'],
    ['Pallof press', 'pallof', 'mage'],
    ['Decline sit-up', 'skrå situps', 'mage'],
    ['Dead bug', 'deadbug', 'mage'],
    ['Side plank', 'sideplanke', 'mage'],
    ['Captain\'s chair leg raise', 'beinhev stol, knee raise', 'mage'],
    // Trapes og underarm
    ['Barbell shrug', 'skuldertrekk stang, shrugs', 'trapes'],
    ['Dumbbell shrug', 'skuldertrekk manualer', 'trapes'],
    ['Wrist curl', 'håndleddscurl', 'trapes'],
    ['Reverse wrist curl', 'omvendt håndleddscurl', 'trapes'],
    ['Reverse curl', 'omvendt curl, overhåndscurl', 'trapes'],
    ['Farmer\'s walk', 'bondegange, farmers walk, farmers carry', 'trapes'],
    // Helkropp
    ['Power clean', 'frivending, clean', 'hel'],
    ['Clean and jerk', 'støt', 'hel'],
    ['Snatch', 'rykk', 'hel'],
    ['Thruster', 'thrusters', 'hel'],
    ['Burpee', 'burpees', 'hel'],
    ['Sled push', 'slede, prowler', 'hel'],
    ['Turkish get-up', 'get up', 'hel']
  ];
  /* Tegninger (start og slutt): Everkinetic (github.com/everkinetic/data), CC BY-SA 4.0, omfarget til Coach sine farger.
   * Muskelkartet bygger på react-body-highlighter (MIT). Begge ligger fritt tilgjengelig. */
  var ART = {"Bench press":"0042","Incline bench press":"0043","Decline bench press":"0051","Dumbbell bench press":"0055","Incline dumbbell press":"0061","Decline dumbbell press":"0052","Smith machine bench press":"0078","Smith machine incline press":"0081","Machine chest press":"0066","Incline machine press":"0081","Cable fly":"0048","Low-to-high cable fly":"0060","High-to-low cable fly":"0048","Dumbbell fly":"0056","Incline dumbbell fly":"0062","Push-up":"0077","Weighted push-up":"0077","Chest dips":"0054","Floor press":"0070","Overhead press":"0004","Seated dumbbell shoulder press":"0038","Machine shoulder press":"0004","Smith machine shoulder press":"0004","Push press":"0004","Lateral raise":"0018","Cable lateral raise":"0018","Machine lateral raise":"0018","Front raise":"0033","Rear delt fly":"0032","Reverse pec deck":"0035","Upright row":"0014","Triceps pushdown":"0205","Rope pushdown":"0206","Overhead cable triceps extension":"0199","Skull crusher":"0183","Overhead dumbbell extension":"0192","Close-grip bench press":"0049","Dips":"0172","Bench dips":"0162","Triceps kickback":"0204","JM press":"0175","Machine dips":"0171","Deadlift":"0099","Pull-up":"0087","Chin-up":"0090","Lat pulldown":"0093","Close-grip lat pulldown":"0096","Single-arm lat pulldown":"0096","Straight-arm pulldown":"0092","Barbell row":"0026","Pendlay row":"0026","Dumbbell row":"0024","Seated cable row":"0025","Chest-supported row":"0029","T-bar row":"0029","Machine row":"0025","Rack pull":"0099","Back extension":"0103","Good morning":"0101","Inverted row":"0086","Barbell curl":"0211","Dumbbell curl":"0224","EZ-bar curl":"0226","Hammer curl":"0227","Incline dumbbell curl":"0214","Preacher curl":"0239","Cable curl":"0212","Bayesian cable curl":"0247","Concentration curl":"0220","Spider curl":"0245","Machine curl":"0253","Standing dumbbell curl":"0223","Back squat":"0122","Front squat":"0138","Goblet squat":"0130","Hack squat":"0123","Smith machine squat":"0124","Leg press":"0127","Bulgarian split squat":"0132","Walking lunge":"0121","Reverse lunge":"0129","Step-up":"0137","Leg extension":"0142","Pendulum squat":"0123","Sissy squat":"0158","Romanian deadlift":"0118","Stiff-leg deadlift":"0118","Sumo deadlift":"0099","Trap bar deadlift":"0107","Lying leg curl":"0117","Seated leg curl":"0119","Hip thrust":"0109","Glute bridge":"0109","Cable kickback":"0112","Hip abduction":"0156","Hip adduction":"0157","Standing calf raise":"0282","Seated calf raise":"0279","Leg press calf raise":"0273","Hanging leg raise":"0021","Cable crunch":"0288","Ab wheel rollout":"0286","Crunch":"0291","Decline sit-up":"0292","Side plank":"0113","Captain's chair leg raise":"0287","Barbell shrug":"0030","Dumbbell shrug":"0005","Reverse curl":"0257","Snatch":"0148"};
  var P = 'CHEST', FD = 'FRONT_DELTOIDS', BD = 'BACK_DELTOIDS', TRI = 'TRICEPS', BI = 'BICEPS', UB = 'UPPER_BACK', LB = 'LOWER_BACK', TR = 'TRAPEZIUS',
    FA = 'FOREARM', GL = 'GLUTEAL', HA = 'HAMSTRING', QU = 'QUADRICEPS', CA = 'CALVES', AB = 'ABS', OB = 'OBLIQUES';
  var GROUP_MUSCLES = {
    bryst: [[P], [FD, TRI]], skuldre: [[FD], [TRI, TR]], triceps: [[TRI], []], rygg: [[UB], [BI, BD]], biceps: [[BI], [FA]],
    forside: [[QU, GL], [HA]], bakside: [[HA, GL], [LB]], legger: [[CA, 'LEFT_SOLEUS', 'RIGHT_SOLEUS'], []], mage: [[AB], [OB]],
    trapes: [[TR], [FA]], hel: [[QU, GL, TR, FD], [HA, LB]]
  };
  var MUSCLES = {
    'Lateral raise': [[FD, BD], [TR]], 'Cable lateral raise': [[FD, BD], [TR]], 'Machine lateral raise': [[FD, BD], [TR]], 'Cable Y-raise': [[FD, BD], [TR]],
    'Rear delt fly': [[BD], [TR, UB]], 'Reverse pec deck': [[BD], [TR, UB]], 'Face pull': [[BD], [TR, UB]], 'Upright row': [[FD, TR], [BD, BI]],
    'Dips': [[TRI], [P, FD]], 'Close-grip bench press': [[TRI], [P, FD]], 'Machine dips': [[TRI], [P, FD]], 'Bench dips': [[TRI], [FD]], 'JM press': [[TRI], [P]],
    'Chest dips': [[P], [TRI, FD]], 'Push-up': [[P], [TRI, FD, AB]], 'Weighted push-up': [[P], [TRI, FD, AB]],
    'Deadlift': [[LB, GL, HA], [UB, TR, QU, FA]], 'Rack pull': [[LB, TR, GL], [UB, HA, FA]], 'Back extension': [[LB], [GL, HA]], 'Good morning': [[LB, HA], [GL]],
    'Pull-up': [[UB], [BI, BD, FA]], 'Chin-up': [[UB, BI], [BD, FA]], 'Straight-arm pulldown': [[UB], [TRI, BD]], 'Barbell row': [[UB, BD], [BI, LB, TR]], 'Pendlay row': [[UB, BD], [BI, LB, TR]],
    'Hammer curl': [[BI, FA], []], 'Reverse curl': [[FA], [BI]], 'Wrist curl': [[FA], []], 'Reverse wrist curl': [[FA], []], "Farmer's walk": [[FA, TR], [AB, OB]],
    'Leg extension': [[QU], []], 'Sissy squat': [[QU], []], 'Leg press': [[QU, GL], [HA]], 'Hack squat': [[QU], [GL]], 'Pendulum squat': [[QU], [GL]],
    'Lying leg curl': [[HA], [CA]], 'Seated leg curl': [[HA], [CA]], 'Nordic curl': [[HA], [GL, CA]],
    'Hip thrust': [[GL], [HA]], 'Glute bridge': [[GL], [HA]], 'Cable kickback': [[GL], [HA]], 'Hip abduction': [['ABDUCTOR', GL], []], 'Hip adduction': [['ABDUCTORS'], []],
    'Kettlebell swing': [[GL, HA], [LB, FD]], 'Russian twist': [[OB], [AB]], 'Side plank': [[OB], [AB]], 'Pallof press': [[OB], [AB]], 'Plank': [[AB], [OB, FD]],
    'Burpee': [[P, QU], [AB, FD, TRI]], 'Sled push': [[QU, GL], [CA, HA]], 'Thruster': [[QU, FD], [GL, TRI]], 'Turkish get-up': [[FD, AB], [GL, OB]]
  };
  var BODY = {"front":[["CHEST",["51.8,41.6 51.0,55.1 58.0,58.0 67.8,55.5 70.6,47.3 62.0,41.6","29.8,46.5 31.4,55.5 40.8,58.0 48.2,55.1 47.8,42.0 37.6,42.0"]],["OBLIQUES",["68.6,63.3 67.3,57.1 58.8,59.6 60.0,64.1 60.4,83.3 65.7,78.8 66.5,69.8","33.9,78.4 33.1,71.8 31.0,63.3 32.2,57.1 40.8,59.2 39.2,63.3 39.2,83.7"]],["ABS",["56.3,59.2 58.0,64.1 58.4,78.0 58.4,92.7 56.3,98.4 55.1,104.1 51.4,107.8 51.0,84.5 50.6,67.3 51.0,57.1","43.7,58.8 48.6,57.1 49.0,67.3 48.6,84.5 48.2,107.3 44.5,103.7 40.8,91.4 40.8,78.4 41.2,64.5"]],["BICEPS",["16.7,68.2 18.0,71.4 22.9,66.1 29.0,53.9 27.8,49.4 20.4,55.9","71.4,49.4 70.2,54.7 76.3,66.1 81.6,71.8 82.9,69.0 78.8,55.5"]],["TRICEPS",["69.4,55.5 69.4,61.6 75.9,72.7 77.6,70.2 75.5,67.3","22.4,69.4 29.8,55.5 29.8,60.8 22.9,73.1"]],["NECK",["55.5,23.7 50.6,33.5 50.6,39.2 61.6,40.0 70.6,44.9 69.4,36.7 63.3,35.1 58.4,30.6","29.0,44.9 30.2,37.1 36.3,35.1 41.2,30.2 44.5,24.5 49.0,33.9 48.6,39.2 38.0,39.6"]],["FRONT_DELTOIDS",["78.4,53.1 79.6,47.8 79.2,41.2 75.9,38.0 71.0,36.3 72.2,42.9 71.4,47.3","28.2,47.3 21.2,53.1 20.0,47.8 20.4,40.8 24.5,37.1 28.6,37.1 26.9,43.3"]],["HEAD",["42.4,2.9 40.0,11.8 42.0,19.6 46.1,23.3 49.8,25.3 54.7,22.4 57.6,19.2 59.2,10.2 57.1,2.4 49.8,0.0"]],["ABDUCTORS",["52.7,110.2 54.3,124.9 60.0,110.2 62.0,100.0 64.9,94.3 60.0,92.7 56.7,104.5","47.8,110.6 44.9,125.3 42.0,115.9 40.4,113.1 39.6,107.3 38.0,102.4 34.7,93.9 39.6,92.2 41.6,99.2 43.7,105.3"]],["QUADRICEPS",["34.7,98.8 37.1,108.2 37.1,127.8 34.3,137.1 31.0,132.7 29.4,120.0 28.2,111.4 29.4,100.8 32.2,94.7","63.3,105.7 64.5,100.0 66.9,94.7 70.2,101.2 71.0,111.8 68.2,133.1 65.3,137.6 62.4,128.6 62.0,111.4","38.8,129.4 38.4,112.2 41.2,118.4 44.5,129.4 42.9,135.1 40.0,146.1 36.3,146.5 35.5,140.0","59.6,145.7 55.5,129.0 60.8,113.9 61.2,130.2 64.1,139.6 62.9,146.5","32.7,138.4 26.5,145.7 25.7,136.7 25.7,127.3 26.9,114.3 29.4,133.5","71.8,113.1 73.9,124.1 73.9,140.4 72.7,145.7 66.5,138.4 70.2,133.5"]],["KNEES",["33.9,140.0 34.7,143.3 35.5,147.3 36.3,151.0 35.1,156.7 29.8,156.7 27.3,152.7 27.3,147.3 30.2,144.1","65.7,140.0 72.2,147.8 72.2,152.2 69.8,157.1 64.9,156.7 62.9,151.0"]],["CALVES",["71.4,160.4 73.5,153.5 76.7,161.2 79.6,167.8 78.4,187.8 79.6,195.5 74.7,195.5","24.9,194.7 27.8,164.9 28.2,160.4 26.1,154.3 24.9,157.6 22.4,161.6 20.8,167.8 22.0,188.2 20.8,195.5","72.7,195.1 69.8,159.2 65.3,158.4 64.1,162.4 64.1,165.3 65.7,177.1","35.5,158.4 35.9,162.4 35.9,166.9 35.1,172.2 35.1,176.7 32.2,182.0 30.6,187.3 26.9,194.7 27.3,187.8 28.2,180.4 28.6,175.5 29.0,169.8 29.8,164.1 30.2,158.8"]],["FOREARM",["6.1,88.6 10.2,75.1 14.7,70.2 16.3,74.3 19.2,73.5 4.5,97.6 0.0,100.0","84.5,69.8 83.3,73.5 80.0,73.1 95.1,98.4 100.0,100.4 93.5,89.4 89.8,76.3","77.6,72.2 77.6,77.6 80.4,84.1 85.3,89.8 92.2,101.2 94.7,99.6","6.9,101.2 13.5,90.6 18.8,84.1 21.6,77.1 21.2,71.8 4.9,98.8"]]],"back":[["HEAD",["50.6,0.0 46.0,0.9 40.9,5.5 40.4,12.8 45.1,20.0 55.7,20.0 59.1,13.6 59.6,4.7 55.7,1.3"]],["TRAPEZIUS",["44.7,21.7 47.7,21.7 47.2,38.3 47.7,64.7 38.3,53.2 35.3,40.9 31.1,36.6 39.1,33.2 43.8,27.2","52.3,21.7 55.7,21.7 56.6,27.2 60.9,32.8 68.9,36.6 64.7,40.4 61.7,53.2 52.3,64.7 53.2,38.3"]],["BACK_DELTOIDS",["29.4,37.0 23.0,39.1 17.4,44.3 18.3,53.6 24.3,49.4 27.2,46.4","71.1,37.0 78.3,39.6 82.6,44.7 81.7,53.6 74.9,48.9 72.3,45.1"]],["UPPER_BACK",["31.1,38.7 28.1,48.9 28.5,55.3 34.0,75.3 47.2,71.1 47.2,66.4 36.6,54.0 33.6,41.3","68.9,38.7 71.9,49.4 71.5,56.2 66.0,75.3 52.8,71.1 52.8,66.4 63.4,54.5 66.4,41.7"]],["TRICEPS",["26.8,49.8 17.9,55.7 14.5,72.3 16.6,81.7 21.7,63.8 26.8,55.7","73.6,50.2 82.1,55.7 86.0,73.2 83.4,82.1 77.9,63.0 73.2,55.7","26.8,58.3 26.8,68.5 23.0,75.3 19.1,77.4 22.6,65.5","72.8,58.3 77.0,64.7 80.4,77.4 76.6,75.3 72.8,68.9"]],["LOWER_BACK",["47.7,72.8 34.5,77.0 35.3,83.4 49.4,102.1 46.8,83.0","52.3,72.8 65.5,77.0 64.7,83.4 50.6,102.1 53.2,83.8"]],["FOREARM",["86.4,75.7 91.1,83.4 93.2,94.0 100.0,106.4 96.2,104.3 88.1,89.4 84.3,83.8","13.6,75.7 8.9,83.8 6.8,93.6 0.0,106.4 3.8,104.3 12.3,88.5 15.7,83.0","81.3,79.6 77.4,77.9 79.1,84.7 91.1,103.8 93.2,108.9 94.5,104.7","18.7,79.6 22.1,77.9 20.9,84.3 9.4,103.0 6.8,108.5 5.1,104.7"]],["GLUTEAL",["44.7,99.6 30.2,108.5 29.8,118.7 31.5,126.0 47.2,121.3 49.4,114.9","55.3,99.1 51.1,114.5 52.3,120.9 68.1,126.0 69.8,119.1 69.4,108.5"]],["ABDUCTOR",["48.1,123.0 44.7,123.0 41.3,125.5 45.1,144.3 48.5,135.7 48.9,129.4","51.9,122.6 55.7,123.4 59.1,126.0 54.9,144.3 51.9,136.2 51.1,129.4"]],["HAMSTRING",["28.9,122.1 31.1,129.4 36.6,126.0 35.3,135.3 34.5,150.2 29.4,158.3 28.9,146.8 27.7,141.3 27.2,131.5","71.5,121.7 69.4,128.9 63.8,126.0 65.5,136.6 66.4,150.2 71.1,158.3 71.5,147.7 72.8,142.1 73.6,131.9","38.7,125.5 44.3,146.0 40.4,166.8 36.2,152.8 37.0,135.3","61.7,125.5 63.4,136.2 64.3,153.2 60.0,166.8 56.2,146.4"]],["KNEES",["34.5,153.2 31.1,159.1 33.6,166.4 37.4,162.6","66.4,153.6 63.0,163.0 66.8,166.4 69.4,159.1"]],["CALVES",["29.4,160.4 28.5,167.2 24.7,179.6 23.8,192.8 25.5,197.0 28.5,193.2 29.8,180.0 31.9,171.1 31.9,166.8","37.4,165.1 35.3,167.7 33.2,171.9 31.1,180.4 30.2,191.9 34.0,200.0 38.7,190.6 39.1,168.9","63.0,165.1 61.3,168.5 61.7,190.6 66.4,199.6 70.6,191.9 68.9,179.6 66.8,170.2","70.6,160.4 72.3,168.5 75.7,179.1 76.6,192.8 74.5,196.6 72.3,193.6 70.6,179.6 68.1,168.1"]],["LEFT_SOLEUS",["28.5,195.7 30.2,195.7 33.6,201.7 30.6,220.0 28.5,213.6 26.8,198.3"]],["RIGHT_SOLEUS",["69.8,195.7 71.9,195.7 73.6,198.3 71.9,213.2 70.2,219.6 67.2,202.1"]]]};
  var MUSCLE_NAMES = { CHEST: 'Bryst', FRONT_DELTOIDS: 'Fremre skulder', BACK_DELTOIDS: 'Bakre skulder', TRICEPS: 'Triceps', BICEPS: 'Biceps', UPPER_BACK: 'Øvre rygg', LOWER_BACK: 'Korsrygg',
    TRAPEZIUS: 'Trapes', FOREARM: 'Underarm', GLUTEAL: 'Sete', HAMSTRING: 'Bakside lår', QUADRICEPS: 'Forside lår', CALVES: 'Legger', LEFT_SOLEUS: 'Legger', RIGHT_SOLEUS: 'Legger',
    ABS: 'Mage', OBLIQUES: 'Skrå magemuskler', ABDUCTORS: 'Innside lår', ABDUCTOR: 'Hofte', NECK: 'Nakke' };
  var list = L.map(function (x) {
    var core = x[0].charAt(0) === '*', name = core ? x[0].slice(1) : x[0];
    return { name: name, aliases: x[1].split(',').map(function (a) { return a.trim(); }).filter(Boolean), group: x[2], core: core, art: ART[name] || null, muscles: MUSCLES[name] || GROUP_MUSCLES[x[2]] };
  });
  var SPLIT_GROUPS = {
    Push: ['bryst', 'skuldre', 'triceps'],
    Pull: ['rygg', 'biceps', 'skuldre', 'trapes'],
    Bein: ['forside', 'bakside', 'legger', 'mage'],
    Overkropp: ['bryst', 'rygg', 'skuldre', 'biceps', 'triceps'],
    Fullkropp: ['forside', 'bakside', 'bryst', 'rygg', 'skuldre', 'mage']
  };
  root.COACH_EXERCISES = { list: list, groups: G, splitGroups: SPLIT_GROUPS, body: BODY, muscleNames: MUSCLE_NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.COACH_EXERCISES;
})(typeof window !== 'undefined' ? window : this);
