import Engine from './Engine.js'
import OnlineChat from './OnlineChat.js'
import Joystick from './Joystick.js'
import Keyboard from './Keyboard.js'
import State from './State.js'

/**
 * ================================
 *      ONLINE GAME ENGINE
 * ================================
 */
export default class Online extends Engine{

    constructor(map, colissionMatrix, shadowMatrix, tileSet, canvas, socket, playerID, server, skin, name, game){
        super(map, colissionMatrix, shadowMatrix, tileSet, canvas, skin)

        this.controls = (window.mobileCheck()) ? new Joystick(this.canvas, this.character, this.emitPlayerPosition, this.triggerShooting, this.emitReload) : new Keyboard(this.character, this.emitPlayerPosition, this.triggerShooting, this.emitReload, this.playerStats)

        this.name = name
        /* Online attributes recevied from the sever */
        this.playerID = playerID
        this.serverDelay = null

        this.socketIO = socket

        /* online team */
        this.team = (game.mode) ? game.team : undefined

        /* game mode */
        this.mode = game.mode

        /* Create a chat room */
        this.chat = new OnlineChat(this.socketIO)

        this.gameUpdates = new State()

        /* Add to emit => the skin */
        this.socketIO.emit('New Player', {
            name: this.name,
            skin: this.skin,
            character: this.character.currentSprite,
            game
        })

        this.state = null
        this.server = server

        /* CALCULATE network speed */
        this.latency = 0

        /* Skins array of images */
        this.onlineSkins = {}

        /* Check change on cartesian value of movement */
        this.cartesianChange = {
            x: false,
            y: false
        }

        this.addSocketListeners()
        
        /* Still players animation */
        this.lastStillUpdate = Date.now()

        /* Add color to score */
        if(this.team === 0)
            document.getElementById('fbi-score').style.color = 'rgb(240, 86, 94)'
        else if(this.team === 1)
            document.getElementById('gambinos-score').style.color = 'rgb(240, 86, 94)'

    }

    /**
     * ==========================
     *      RENDER FUNCTION
     * ==========================
     * 
     * Called once sprites are loaded by the engine
     */ 
    render = (timeSinceLastFrame) => {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)

        if(this.gameUpdates.buffer.length)
            this.interpolate()

        if(this.playerStats)
            this.calculateLocalMap()
        
        this.calculateOffset()
        this.drawMap()
        this.drawShadows()
        this.drawObjects()

        if(this.state && this.state.flags)
            this.drawFlags()

        if(this.state){
            this.drawBonusKits()
            this.drawBullets()
            this.drawOtherPlayers()
            this.showScoresTable()
        }

        this.controls.animate()

        this.context.font = '16px cursive'
        this.context.fillStyle = 'black'

        if(Date.now() - this.lastStillUpdate >= this.character.animationSpeed){

            this.staticAnimation.x ++

            if(this.staticAnimation.x === 3) 
                this.staticAnimation.x = 0

            this.lastStillUpdate = Date.now()
        }

        //this.drawCharacter()

        this.context.fillStyle = "black"
        this.context.fillText(`FPS: ${this.FPS}`, (this.screenTiles.x * this.tile.height) - 100, 50)
        this.context.fillText(`Net: ${this.latency}ms`, (this.screenTiles.x * this.tile.height) - 100, 70)

        if(this.reloading || this.currentAmmo === 0){
            this.context.textAlign = 'center'
            this.context.fillText('Reloading...',(this.screenTiles.x * this.tile.width)/2, this.canvas.height - 10)
        }
            
        requestAnimationFrame(() => {

            /* FPS Counter */
            let now = new Date()
            timeSinceLastFrame = this.lastFrameTime ? (now - this.lastFrameTime): 0
                
            this.render(timeSinceLastFrame)

            this.lastFrameTime = now
            this.FPS = Math.floor(1/(timeSinceLastFrame/1000)) 
        })
    }

    /** 
    *  ============================
    *       INTERPOLATE STATE
    *  ============================
    */

    interpolate(){

        this.state = this.gameUpdates.getCurrentState()
        this.updateState()
        
    }

    /* Send data back to the server */
    emitPlayerPosition = (movement) =>{
        console.log(movement);
        this.socketIO.emit('movement', {
            movement,
            cartisianMovement: this.controls.cartesianValueOfMovement,
            character: {
                currentSprite: this.character.currentSprite
            }
        })
    }

    /* Calculates the position of the map in the browser => startX and startY */
    calculateLocalMap(){
        let serverWidth = this.transformServerMagnitudesX(this.playerStats.posX)
        let serverHeight = this.transformServerMagnitudesY(this.playerStats.posY)

        /* X axis smoothness */
        if(this.cameraSmoothness.offsetX < this.cameraSmoothness.limitX && this.cameraSmoothness.offsetX > -this.cameraSmoothness.limitX && this.playerStats.cartesianValueOfMovement.x){
            this.cameraSmoothness.velX = (this.cameraSmoothness.velX > 1.8) ? 2 : this.cameraSmoothness.velX / this.cameraSmoothness.friction
            this.cameraSmoothness.offsetX += this.cameraSmoothness.velX *(this.playerStats.cartesianValueOfMovement.x)
        }

        else if(((this.playerStats.cartesianValueOfMovement.x > 0 && this.cameraSmoothness.offsetX < 0) || (this.playerStats.cartesianValueOfMovement.x < 0 && this.cameraSmoothness.offsetX > 0) 
        || (this.playerStats.cartesianValueOfMovement.x === 0)) && this.cameraSmoothness.offsetX !== 0){

            this.cameraSmoothness.velX = (this.cameraSmoothness.velX <= .4) ? .4 : this.cameraSmoothness.velX * this.cameraSmoothness.friction
            if(this.cameraSmoothness.offsetX < 0)
                this.cameraSmoothness.offsetX += this.cameraSmoothness.velX
            else
                this.cameraSmoothness.offsetX -= this.cameraSmoothness.velX
        }

        /* Y axis smootheness */
        if(this.cameraSmoothness.offsetY < this.cameraSmoothness.limitX && this.cameraSmoothness.offsetY > -this.cameraSmoothness.limitX && this.playerStats.cartesianValueOfMovement.y){
            this.cameraSmoothness.velY = (this.cameraSmoothness.velY > 1.7) ? 2 : this.cameraSmoothness.velY / this.cameraSmoothness.friction
            this.cameraSmoothness.offsetY += this.cameraSmoothness.velY *(this.playerStats.cartesianValueOfMovement.y * -1)
        }
        else if(((this.playerStats.cartesianValueOfMovement.y < 0 && this.cameraSmoothness.offsetY < 0) || (this.playerStats.cartesianValueOfMovement.y > 0 && this.cameraSmoothness.offsetY > 0) 
        || (this.playerStats.cartesianValueOfMovement.y === 0)) && this.cameraSmoothness.offsetY !== 0){
            this.cameraSmoothness.velY = (this.cameraSmoothness.velY <= .4) ? .4 : this.cameraSmoothness.velY * this.cameraSmoothness.friction

            if(this.cameraSmoothness.offsetY < 0)
                this.cameraSmoothness.offsetY += this.cameraSmoothness.velY
            else
                this.cameraSmoothness.offsetY -= this.cameraSmoothness.velY
        }
            
        //console.log(`x: ${this.cameraSmoothness.offsetX}, y: ${this.cameraSmoothness.offsetY}`)
        /* Offset smooth camera */

        this.tileMap.startX = ((this.screenTiles.x * this.tile.width)/2 - this.tile.width/2) - serverWidth + this.cameraSmoothness.offsetX
        this.tileMap.startY = ((this.screenTiles.y * this.tile.height)/2 - this.tile.height/2) - serverHeight + this.cameraSmoothness.offsetY

    }

    /**
     *  ==========================
     *      DRAW ONLINE PLAYERS 
     *  ==========================
     */
    /* Loops server players and calls the drawOnlineCharacter to draw each player with the data from the socket */
    drawOtherPlayers(){
        if(Array.isArray(this.state.players)){
            let colors = (this.state.players[0][this.playerID]) ? [this.colors.ally, this.colors.enemy] : [this.colors.enemy, this.colors.ally]

            this.drawPlayers(this.state.players[0], colors[0])
            this.drawPlayers(this.state.players[1], colors[1])

        }else{
            this.drawPlayers(this.state.players)
        }

    }

    drawPlayers(players, lifeColor = this.colors.enemy){

        let quitePlayers = false

        for(let playerID in players){

            let characterX = this.transformServerMagnitudesX(players[playerID].posX)+this.tileMap.startX
            let characterY = this.transformServerMagnitudesY(players[playerID].posY)+this.tileMap.startY

            /* If the character is outside the screen don't draw it */
            if(characterX + this.tile.width >= 0 && characterX < this.screenTiles.x * this.tile.width && characterY+ this.tile.height >= 0 && characterY < this.screenTiles.y * this.tile.height && players[playerID].character){

                let skin = (players[playerID].skin == this.skin) ? this.character.spriteSheet.img : this.onlineSkins[players[playerID].skin]
                      
                /* Check if any player is still */
                if(players[playerID].still && players[playerID].life > 0)
                    quitePlayers = true
                
                if(players[playerID].character.currentSprite.x % 2 ==1 && !players[playerID].still && !window.mobileCheck()){
                    let distanceFromFootstep = Math.floor(Math.sqrt(Math.pow(this.playerStats.posX - players[playerID].posX,2) + (Math.pow(this.playerStats.posY - players[playerID].posY,2))))
                    if(distanceFromFootstep <= this.soundWaves.footsteps && !window.mobileCheck()){
                    
                        this.sounds.footsteps[playerID].sound.volume = (1 - distanceFromFootstep/this.soundWaves.footsteps)/10
                        this.sounds.footsteps[playerID].sound.play()
                    }
                }

                if(skin){
                    let color = (playerID === this.playerID) ? this.colors.self : lifeColor
                    this.drawLife(characterX, characterY -6, players[playerID].life, color)

                    let character = {
                        flip: (players[playerID].character.currentSprite.y === 0 || players[playerID].character.currentSprite.y === 2) ? 1 : players[playerID].character.currentSprite.flip,
                        y: (players[playerID].shooting && players[playerID].life > 0) ? players[playerID].character.currentSprite.y + 6 : players[playerID].character.currentSprite.y,
                        x: (players[playerID].still && players[playerID].life > 0) ? this.staticAnimation.x : players[playerID].character.currentSprite.x,
                    }
                    this.drawOnlineCharacter({posX: characterX, posY: characterY}, character , skin, players[playerID].playerName)
                }
            }
        }

        return quitePlayers
    }

    /* Draws online players from server's data */
    drawOnlineCharacter(player, onlineCharacter, skin, name){

        console.log(onlineCharacter.x);

        this.context.textAlign = 'center'
        this.context.fillStyle = 'black'
        this.context.fillText(name, player.posX + this.tile.width/2, player.posY - 10)
        this.context.save()

        this.context.scale(onlineCharacter.flip, 1)

        let posX = (onlineCharacter.flip === 1) ?  player.posX : player.posX * onlineCharacter.flip - this.tile.width
        
        this.context.drawImage(skin, onlineCharacter.x * this.character.spriteSheet.width, onlineCharacter.y * this.character.spriteSheet.height
                                , this.character.spriteSheet.width, this.character.spriteSheet.height, posX, player.posY, this.tile.width, this.tile.height)
        this.context.restore()
    }

    /* Uses the rule of three mathematic formula to transform values from the server */
    transformServerMagnitudesX(serverValue){
        return (this.tileMap.width * serverValue) / this.server.width
    }

    transformServerMagnitudesY(serverValue){
        return (this.tileMap.height * serverValue) / this.server.height
    }

    /* Load new skin from the server */

    loadServerSkin(src){
        let characterSkin = new Image()
        characterSkin.src = `../assets/characters/${src}.png`

        this.onlineSkins[src] = characterSkin
    }

    /** 
     * =========================
     *      Bullet Mechanics
     * =========================
    */

    /* Draw bullets contain on the server */

    drawBullets(){

        if(this.state.bullets.length > 0){

            this.state.bullets.map((element) => {

                let bulletX = this.transformServerMagnitudesX(element.posX)+this.tileMap.startX
                let bulletY = this.transformServerMagnitudesY(element.posY)+this.tileMap.startY

                if(bulletX >= 0 && bulletX < this.screenTiles.x * this.tile.width && bulletY + this.bulletSprite.width >= 0 && bulletY < this.screenTiles.y * this.tile.height){
                    this.context.save()
                    this.context.scale(element.flip, 1)
    
                    let posX = (element.flip === 1) ? bulletX : bulletX  * element.flip

                    let spritePosX = 0
                    let spritePosY = element.spriteY * 16

                    if(element.spriteY === 0){
                        spritePosX+=5
                        posX-=(this.canvas.width*.005)
                    }
                    else if(element.spriteY === 1)
                        posX-=(this.canvas.width*.015)
                    else if(element.spriteY === 2)
                        bulletY-=(this.canvas.width * .01)
    
                    this.context.drawImage(this.bulletSprite.img, spritePosX, spritePosY, 16, 16, 
                        posX,  bulletY, this.bulletSprite.width, this.bulletSprite.height)

                    this.context.restore()
                    
                    
                    /* Draw actual trayectory of the bullet */
                    /*
                    this.context.beginPath()
                    this.context.arc(this.transformServerMagnitudesX(element.posX)+this.tileMap.startX, this.transformServerMagnitudesY(element.posY) +this.tileMap.startY, 5, 0, 2 * Math.PI)
                    this.context.fill()
                    */
                }
            })
        }
    }

    /**
     *  =========================
     *        DRAW BONUS KITS
     *  =========================
     */

    drawBonusKits(){
        const drawKit = (img, location) => {
            this.context.drawImage(img, location.x, location.y, this.kits.width, this.kits.height)
        }

        let bulletKitPos
        let medicalKitPos

        /* calculate local position of bulletKit */
        if(this.state.bonusKits.bulletKit){
            bulletKitPos = {
                x:  this.transformServerMagnitudesX(this.state.bonusKits.bulletKit.x) + this.tileMap.startX,
                y: this.transformServerMagnitudesY(this.state.bonusKits.bulletKit.y) + this.tileMap.startY
            }
        }

        /* calculate local position of medicalKit */
        if(this.state.bonusKits.medicalKit){
            medicalKitPos = {
                x:  this.transformServerMagnitudesX(this.state.bonusKits.medicalKit.x) + this.tileMap.startX,
                y: this.transformServerMagnitudesY(this.state.bonusKits.medicalKit.y) + this.tileMap.startY
            }
        }
         

        if(bulletKitPos && bulletKitPos.x + this.tile.width >= 0 && bulletKitPos.x < this.screenTiles.x * this.tile.width && bulletKitPos.y + this.tile.height >= 0 && bulletKitPos.y < this.screenTiles.y * this.tile.height)
            drawKit(this.kits.bullets, bulletKitPos)

        if(medicalKitPos && medicalKitPos.x + this.tile.width >= 0 && medicalKitPos.x < this.screenTiles.x * this.tile.width && medicalKitPos.y + this.tile.height >= 0 && medicalKitPos.y < this.screenTiles.y * this.tile.height)
            drawKit(this.kits.medical, medicalKitPos)
    }

    /**
     *  ============================
     *      DRAW FLAGS ON CANVAS
     *  ============================
     */
    drawFlags(){
        /* Pick flag color depending on the team */
        let flags = (this.state.players[0][this.playerID]) ? [this.flags.blue, this.flags.red, this.pointers.blue, this.pointers.red] : [this.flags.red, this.flags.blue, this.pointers.red, this.pointers.blue]

        /* Server blue flag */
        let serverBlueFlag = {
            x: this.transformServerMagnitudesX(this.state.flags[0].pos.x)+this.tileMap.startX,
            y: this.transformServerMagnitudesY(this.state.flags[0].pos.y)+this.tileMap.startY
        }

        let serverRedFlag = {
            x: this.transformServerMagnitudesX(this.state.flags[1].pos.x)+this.tileMap.startX,
            y: this.transformServerMagnitudesY(this.state.flags[1].pos.y)+this.tileMap.startY
        }

        let carrierBlue = (this.state.flags[0].carrier) ? this.state.players[1][this.state.flags[0].carrier] : false
        let carrierRed = (this.state.flags[1].carrier) ? this.state.players[0][this.state.flags[1].carrier] : false

        /* render the flags onto the canvas */
        this.renderFlag(flags[0], serverBlueFlag, carrierBlue, flags[2])
        this.renderFlag(flags[1], serverRedFlag, carrierRed, flags[3])

    }

    /* Show scores table */
    showScoresTable(){
        if(this.controls.showScores && this.state){
            if(!this.mode){
                let sortedPlayers = this.bubbleSort()
                this.displayScoreRows(sortedPlayers, document.getElementById('site-scores-data'))
            }else{
                /* decide team colors and diplay */
                let sortedBlueTeam = this.bubbleSort(this.state.players[0])
                let sortedRedTeam = this.bubbleSort(this.state.players[1])
                
                let teams = (this.state.players[0][this.playerID]) ? [sortedBlueTeam, sortedRedTeam] : [sortedRedTeam, sortedBlueTeam]

                this.displayScoreRows(teams[0], document.getElementById('scores-team-blue'))
                this.displayScoreRows(teams[1], document.getElementById('scores-team-red'))
            }
        }
    }

    /* Display every row on the score table */
    displayScoreRows(players, table){

        /* Html element previously set to show this table */
        table.innerHTML = ""

        let scoreTable = document.getElementById('site-individual-scores')

        players.map((player) => {
            /* Parent div */
            let div = document.createElement('div')
            let classes = 'table-row clearfix'

            if(player.id === this.playerID)
                classes+= " current-player"

            div.classList = classes

            /* Create HTML element to display username */
            let usernameDiv = document.createElement('div')
            usernameDiv.classList = "entry"
            let username = document.createElement('p')
            username.innerHTML = player.name
            usernameDiv.append(username)

            /*  HTML Element to display number of kills */
            let killsDiv = document.createElement('div')
            killsDiv.classList = "entry"
            let kills = document.createElement('p')
            kills.innerHTML = player.kills
            killsDiv.append(kills)

            /* HTML element to display number of deaths */
            let deathsDiv = document.createElement('div')
            deathsDiv.classList = "entry"
            let deaths = document.createElement('p')
            deaths.innerHTML = player.deaths
            deathsDiv.append(deaths)

            div.append(usernameDiv)
            div.append(killsDiv)
            div.append(deathsDiv)

            table.append(div)

        })

        if(scoreTable.style.display === 'none' || !scoreTable.style.display){
            scoreTable.style.display = 'block'
        }
        
    }

    /* Bubble sort for sorting score's table */
    bubbleSort = (players = this.state.players) => {
        let playersArr = Object.values(Object.fromEntries(Object.entries(players).map(([id, player]) => [id, {kills: player.kills, deaths: player.deaths, name: player.playerName, id}])))
        let swapped

        do {
            swapped = false;
            for (let i = 0; i < playersArr.length - 1; i++) {
                if (playersArr[i].kills < playersArr[i + 1].kills) {
                    let tmp = playersArr[i]
                    playersArr[i] = playersArr[i + 1]
                    playersArr[i + 1] = tmp
                    swapped = true
                }
            }
        } while (swapped)

        return playersArr
    }

    renderFlag(img, pos, carrier, pointer){

        /* Draw flag if on screen */
        if(pos && pos.x + this.tile.width >= 0 && pos.x < this.screenTiles.x * this.tile.width && pos.y + this.tile.height >= 0 && pos.y < this.screenTiles.y * this.tile.height){
            let flip = (carrier) ? carrier.character.currentSprite.flip * (-1) : 1

            let posX = (flip === 1) ?  pos.x : pos.x * flip - this.tile.width

            this.context.save()
            this.context.scale(flip, 1)
            this.context.drawImage(img, this.staticAnimation.x * this.character.spriteSheet.width, 0, this.character.spriteSheet.width, this.character.spriteSheet.height, posX, pos.y, this.tile.width, this.tile.height)
        }else{

            /* Draw indicator of flag's position */
            let posX = pos.x
            let posY = pos.y

            if(pos.x <= 0)
                posX = 0
            else if (pos.x >= this.screenTiles.x * this.tile.width - this.tile.width/2)
                posX = this.screenTiles.x * this.tile.width - this.tile.width/2

            if(pos.y <= 0)
                posY = 0
            else if(pos.y >= this.screenTiles.y * this.tile.height - this.tile.height/2)
                posY = this.screenTiles.y * this.tile.height - (this.tile.height/2)
            
            //console.log(`${posX}, ${posY}`);    
            this.context.drawImage(pointer, posX, posY, this.tile.width/2, this.tile.height/2)
        }

        this.context.restore()
    }

    /** Update state */
    updateState(){

        this.playerStats = (Array.isArray(this.state.players)) ? this.state.players[0][this.playerID] || this.state.players[1][this.playerID] 
                            : this.state.players[this.playerID]

        if(this.playerStats){
            if(this.currentAmmo !== this.playerStats.bulletsCharger){
                this.currentAmmo = this.playerStats.currentAmmo
                this.bulletsHTMLElement.innerText = `${this.currentAmmo}/${this.playerAmmunition}`
            }
            /* Check if the player is reloading */
            this.reloading = this.playerStats.reloading
        }

    }

    /**
    *  =============================
    *         STATE Listener
     *  =============================
    */ 
    addStateListener(){
        
        /* SOCKET LISTENERS */
        this.socketIO.on('state', (data) =>{
            this.gameUpdates.processGameUpdate(data)
            this.serverDelay = Date.now() - data.serverTime
        })

    }

    /**
     *  ==========================
     *      SOCKET LISTENERS
     *  ==========================
     */

     addSocketListeners(){
         /* When new players enter the lobby, they must load other users skins and default info about the skin selected */
         this.socketIO.on('Load Skins, ammunition and sounds', ({skins, ids}) => {
            skins.srcArray.forEach((value) => {
                if(value != this.skin){
                    this.loadServerSkin(value)
                }
            })

            this.playerAmmunition = skins.characterInfo.bullets
            this.currentAmmo = this.playerAmmunition
            this.shootingDelay = skins.characterInfo.shootingDelay

            this.bulletsHTMLElement.innerText = `${this.currentAmmo}/${this.playerAmmunition}`

            /* Load a footstep audio for every player already in the room */
            ids.map((id) => {
                this.sounds.footsteps[id] = {sound: new Audio('../assets/sounds/footstep.mp3')}
            })
        })

        /* when a new player enters, other people must load their skin */
        this.socketIO.on('Load New Skin', ({src, id}) =>{
            let element = this.onlineSkins[src]
            if(!element && src != this.skin)
                this.loadServerSkin(src)

            let availableSlot = Object.keys(this.sounds.footsteps).find((idPlayer) => this.sounds.footsteps[idPlayer].free)

            if(availableSlot){
                this.sounds.footsteps[id] = {sound: this.sounds.footsteps[availableSlot].sound}
                delete this.sounds.footsteps[availableSlot]
            }else
                this.sounds.footsteps[id] = {sound: new Audio('../assets/sounds/footstep.mp3')}

        })

        /* When a player's been disconnected set its footstep variable as free, so that new players can used it, without needing to load the audio again */
        this.socketIO.on('Player Disconnected', (id) => {
            if(this.sounds.footsteps[id])
                this.sounds.footsteps[id].free = true
            
            console.log(`Someone disconnected from the lobby`);
        })

        /* When the score changes */
        this.socketIO.on('New leaderboard', (data) => {

            let positions = ['trophy', 'medal', 'award']
            let score = document.getElementById('scores')

            score.innerHTML = ''

            data.map((elem, index) => {

                let text = document.createElement('p')
                if(elem.id === this.playerID)
                    text.style.color = '#f0565e'

                let scoreText = `<i class="fas fa-${positions[index]}"></i>.${elem.name}: ${elem.score}`
                text.innerHTML = scoreText

                score.appendChild(text)
            })

        })

        /* Scores from a team based lobby */
        this.socketIO.on('New teams leaderboard', (data)=>{
            document.getElementById('fbi-score').innerHTML = data.blueTeam
            document.getElementById('gambinos-score').innerHTML = data.redTeam
        })

        this.socketIO.on('pong', (ms) => {
            this.latency= ms
        })

        /* Play sound effect */
        this.socketIO.on('Bullet sound', ({bullet, sound}) => {

            if(this.playerStats){
                let distanceFromGunshot = Math.floor(Math.sqrt(Math.pow(this.playerStats.posX - bullet.x,2) + (Math.pow(this.playerStats.posY - bullet.y,2))))

                if(distanceFromGunshot <= this.soundWaves.bullets && !window.mobileCheck()){
                    if(!this.sounds[sound].paused)
                        this.sounds[sound].currentTime = 0
                
                    this.sounds[sound].volume = (1 - distanceFromGunshot/this.soundWaves.bullets)/2
                    this.sounds[sound].play()
                }
            }
        })

        /** 
         *  ===========================================
         *      SOUND EFFECTS WHEN PICKING A BONUS
         *  ===========================================
        */
       this.socketIO.on('Capture medicalKit', () => {
           if(!window.mobileCheck())
                this.sounds.healing.play()
       })

       this.socketIO.on('Capture bulletKit', () => {
           if(!window.mobileCheck())
                this.sounds.reload.play()
       })

     }
    /* Emit bullet to server */

    emitBullet(dir, spriteY){

        this.socketIO.emit('shoot', {
            bullet: {
                dir,
                spriteY
            },
            shootTime: Date.now() - this.serverDelay
        })
    }

    emitReload = () => {

        if(this.currentAmmo !== this.playerAmmunition && !this.reloading){
            this.reloading = true
            this.socketIO.emit('reload weapon')
        }
    }
}