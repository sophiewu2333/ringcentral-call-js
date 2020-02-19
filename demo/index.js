$(function() {
  var rcsdk = null;
  var platform = null;
  var loggedIn = false;
  var subscription = null;
  var rcCallControl = null;
  var rcWebPhone = null;
  var rcCall = null;
  var redirectUri = getRedirectUri();

  var $app = $('#app');
  var $authFlowTemplate = $('#template-auth-flow');
  var $callTemplate = $('#template-call');
  var $callControlTemplate = $('#template-call-control');
  var $incomingCallTemplate = $('#template-incoming');
  var $callPage = null;
  var $loadingModal = $('.loading-modal');

  function getRedirectUri() {
    if (window.location.pathname.indexOf('/index.html') > 0) {
      return window.location.protocol + '//' + window.location.host + window.location.pathname.replace('/index.html', '') + '/redirect.html';
    }
    return window.location.protocol + '//' + window.location.host + window.location.pathname + 'redirect.html';
  }

  function cloneTemplate($tpl) {
    return $($tpl.html());
  }

  function initCallControl() {
    subscription = rcsdk.createSubscription();
    var cachedSubscriptionData = rcsdk.cache().getItem('rc-call-control-subscription-key');
    var eventFilters = ['/restapi/v1.0/account/~/extension/~/telephony/sessions'];
    if (cachedSubscriptionData) {
      try {
        subscription.setSubscription(cachedSubscriptionData); // use the cache
      } catch (e) {
        console.error('Cannot set subscription from cache data', e);
        subscription.setEventFilters(eventFilters);
      }
    } else {
      subscription.setEventFilters(eventFilters);
    }
    subscription.on([subscription.events.subscribeSuccess, subscription.events.renewSuccess], function() {
      rcsdk.cache().setItem(cacheKey, subscription.subscription());
    });
    rcCallControl = new RingCentralCallControl({ sdk: rcsdk });
    window.rcCallControl = rcCallControl;
    subscription.on(subscription.events.notification, function(msg) {
      // console.log(JSON.stringify(msg, null, 2));
      window.rcCallControl.onNotificationEvent(msg)
    });
    subscription.on(subscription.events.renewError, function() {
      rcsdk.platform().loggedIn().then(function(loggedIn) {
        if (loggedIn) {
          subscription.reset().setEventFilters(eventFilters).register();
        }
      })
    });
    subscription.on(subscription.events.automaticRenewError, function() {
      subscription.resubscribe();
    });
    subscription.on(subscription.events.subscribeError, function() {
      rcsdk.platform().loggedIn().then(function(loggedIn) {
        if (loggedIn) {
          subscription.reset().setEventFilters(eventFilters).register();
        }
      })
    });
    subscription.register();
  }

  function initWebPhone({ appKey }) {
    return platform.post('/client-info/sip-provision', {
      sipInfo: [{transport: 'WSS'}]
    }).then(function(res) {
      var sipProvision = res.json()
      rcWebPhone = new RingCentral.WebPhone(sipProvision, {
        appKey,
        appName: 'RingCentral Call Demo',
        appVersion: '0.0.1',
        logLevel: 2,
        uuid: sipProvision.device.extension.id,
      })
      window.addEventListener('unload', function () {
        if (rcWebPhone) {
          rcWebPhone.userAgent.stop();
        }
      });
      initCallSDK()
    });
  }

  function initCallSDK() {
    rcCall = new RingCentralCall({ webphone: rcWebPhone, activeCallControl: rcCallControl })
    window.rcCall = rcCall
  }

  function showCallPage() {
    $loadingModal.modal('show');
    $callPage = cloneTemplate($callTemplate);
    var $callType = $callPage.find('select[name=callType]').eq(0);
    var $deviceSelect = $callPage.find('select[name=device]').eq(0);
    var $phoneNumber = $callPage.find('input[name=number]').eq(0);
    var $fromNumberSelect = $callPage.find('select[name=fromNumber]').eq(0);
    var $deviceRefresh = $callPage.find('.device-refresh').eq(0);
    var $callForm = $callPage.find('.call-out-form').eq(0);
    var $logout = $callPage.find('.logout').eq(0);
    var $deviceRow = $callPage.find('#device-row').eq(0);
    var $fromNumberRow = $callPage.find('#from-number-row').eq(0);
    function refreshDevices() {
      $deviceSelect.empty();
      var devices = rcCall.activeCallControl.devices.filter(function(d) { return d.status === 'Online' });
      if (devices.length === 0) {
        $deviceSelect.append('<option value="">No device availiable</option>');
        return;
      }
      devices.forEach(function (device) {
        $deviceSelect.append('<option value="' + device.id + '">' + device.name + '</option>')
      });
    }
    function refreshFromNumbers() {
      $fromNumberSelect.empty();
      platform.get('/restapi/v1.0/account/~/extension/~/phone-number').then(function (response) {
        var data = response.json();
        var phoneNumbers = data.records;
        phoneNumbers.filter(function(p) {
          return (p.features && p.features.indexOf('CallerId') !== -1) || (p.usageType === 'ForwardedNumber' && p.status === 'PortedIn');
        }).forEach(function (p) {
          $fromNumberSelect.append('<option value="' + p.phoneNumber + '">' + p.phoneNumber + '-' + p.usageType + '</option>')
        });
      })
    }
    function onInitializedEvent() {
      refreshDevices();
      refreshFromNumbers();
      refreshCallList();
      rcCall.sessions.forEach(function(session) {
        session.on('status', function() {
          refreshCallList();
        });
      });
      $('.modal').modal('hide');
    }
    if (rcCall.webphoneRegistered || rcCall.activeCallControlReady) {
      onInitializedEvent();
    }
    rcCall.on('webphone-registration-failed', onInitializedEvent);
    rcCall.on('active-call-control-ready', onInitializedEvent);
    if ($callType.val() === 'webphone') {
      $deviceRow.hide();
    }
    $callType.on('change', function () {
      if ($callType.val() === 'webphone') {
        refreshFromNumbers();
        $deviceRow.hide();
        $fromNumberRow.show();
      } else {
        refreshDevices();
        $deviceRow.show();
        $fromNumberRow.hide();
      }
    })
    rcCall.on('new', function(session) {
      // console.log('new');
      // console.log(JSON.stringify(session.data, null, 2));
      refreshCallList();
      session.on('status', function(event) {
        // console.log(event);
        refreshCallList();
      });
      if (session.direction === 'Inbound') {
        showIncomingCallModal(session);
      }
    });
    $callForm.on('submit', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var deviceId = $deviceSelect.val();
      var phoneNumber = $phoneNumber.val();
      var fromNumber = $fromNumberSelect.val();
      var params = {};
      if (phoneNumber.length > 5) {
        params.phoneNumber = phoneNumber;
      } else {
        params.extensionNumber = phoneNumber;
      }
      rcCall.makeCall({
        type: 'webphone',
        toNumber: phoneNumber,
        fromNumber,
        deviceId,
      }).then(function (session) {
        showCallControlModal(session);
        refreshCallList();
        session.on('status', function() {
          refreshCallList();
        });
      });
    });
    $deviceRefresh.on('click', function(e) {
      e.preventDefault();
      rcCall.activeCallControl.refreshDevices().then(function () {
        refreshDevices();
      });
    });
    $logout.on('click', function(e) {
      e.preventDefault();
      platform.logout().then(function () {
        window.location.reload();
      });
    });
    $app.empty().append($callPage);
    document.addEventListener('click', (event) => {
      var target = event.target;
      if (target.nodeName !== 'TD') {
        return;
      }
      var sessionId = target.parentElement.getAttribute('data-id');
      if (!sessionId) {
        return;
      }
      var session = rcCall.sessions.find(s => s.id === sessionId);
      if (!session) {
        return;
      }
      var status = session.status;
      var party = session.party;
      if (status === 'VoiceMail' || status === 'Disconnected' || !party) {
        return;
      }
      if ((status === 'Proceeding' || status === 'Setup') && party.direction === 'Inbound') {
        showIncomingCallModal(session);
        return;
      }
      showCallControlModal(session);
    });
  }

  function refreshCallList() {
    var $callList = $callPage.find('.call-list').eq(0);
    $callList.empty();
    rcCall.sessions.forEach(function (session) {
      if (!session.party) {
        return;
      }
      $callList.append(
        '<tr data-id="' + session.id + '">' +
          '<td>' + session.direction + '</td>' +
          '<td>' + session.from.phoneNumber + '</td>' +
          '<td>' + session.to.phoneNumber + '</td>' +
          '<td>' + session.status + '</td>' +
          '<td>' + session.otherParties.map(p => p.status.code).join(',') + '</td>' +
        '</tr>'
      )
    });
  }

  function showCallControlModal(session) {
    var $modal = cloneTemplate($callControlTemplate).modal();
    var $transferForm = $modal.find('.transfer-form').eq(0);
    var $transfer = $modal.find('input[name=transfer]').eq(0);
    var $from = $modal.find('input[name=from]').eq(0);
    var $to = $modal.find('input[name=to]').eq(0);
    var $myStatus = $modal.find('input[name=myStatus]').eq(0);
    var $otherStatus = $modal.find('input[name=otherStatus]').eq(0);

    function refreshPartyInfo() {
      $from.val(session.from.phoneNumber);
      $to.val(session.to.phoneNumber);
      $myStatus.val(session.status);
      $otherStatus.val(session.otherParties.map(p => p.status.code).join(','));
    }
    refreshPartyInfo();

    $modal.find('.hangup').on('click', function() {
      session.hangup();
      $modal.modal('hide');
    });
    $modal.find('.mute').on('click', function() {
      session.mute().then(function() {
        console.log('muted');
      }).catch(function(e) {
          console.error('mute failed', e.stack || e);
      });
    });

    $modal.find('.unmute').on('click', function() {
      session.unmute().then(function() {
        console.log('unmuted');
      }).catch(function(e) {
          console.error('unmute failed', e.stack || e);
      });
    });
    $modal.find('.hold').on('click', function() {
      session.hold().then(function() {
        console.log('Holding');
      }).catch(function(e) {
          console.error('Holding failed', e.stack || e);
      });
    });
    $modal.find('.unhold').on('click', function() {
      session.unhold().then(function() {
        console.log('UnHolding');
      }).catch(function(e) {
          console.error('UnHolding failed', e.stack || e);
      });
    });
    $modal.find('.startRecord').on('click', function() {
      const recordingId = session.recordings[0] && session.recordings[0].id;
      session.startRecord({ recordingId }).catch(function(e) {
        console.error('create record failed', e.stack || e);
      });
    });
    $modal.find('.stopRecord').on('click', function() {
      if (session.recordings.length === 0) {
        return;
      }
      const recordingId = session.recordings[0] && session.recordings[0].id;
      session.stopRecord({ recordingId }).then(function() {
        console.log('recording stopped');
      }).catch(function(e) {
        console.error('stop recording failed', e.stack || e);
      });
    });
    $transferForm.on('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var phoneNumber = $transfer.val();
      session.transfer(phoneNumber).then(function () {
        console.log('transfered');
      }).catch(function(e) {
        console.error('transfer failed', e.stack || e);
      });
    });
    session.on('status', function() {
      if (session.status === 'Disconnected') {
        $modal.modal('hide');
        return;
      }
      refreshPartyInfo();
    });
  }

  function showIncomingCallModal(session) {
    var $modal = cloneTemplate($incomingCallTemplate).modal();
    var $from = $modal.find('input[name=from]').eq(0);
    var $to = $modal.find('input[name=to]').eq(0);
    var $forwardForm = $modal.find('.forward-form').eq(0);
    var $forward = $modal.find('input[name=forward]').eq(0);
    var $answer = $modal.find('.answer').eq(0);
    $from.val(session.from.phoneNumber);
    $to.val(session.to.phoneNumber);

    $modal.find('.toVoicemail').on('click', function() {
      session.toVoicemail();
    });
    if (!session.webphoneSessionConnected) {
      $answer.hide();
      session.on('webphoneSessionConnected', function () {
        $answer.show();
      });
    }
    $answer.on('click', function() {
      if (session.webphoneSession) {
        session.answer();
      }
    });
    $forwardForm.on('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var phoneNumber = $forward.val();
      var params = {};
      if (phoneNumber.length > 5) {
        params.phoneNumber = phoneNumber;
      } else {
        params.extensionNumber = phoneNumber;
      }
      session.telephonySession.forward(params).then(function () {
        console.log('forwarded');
      }).catch(function(e) {
        console.error('forward failed', e.stack || e);
      });
    });
    var hasAnswered = false;
    session.on('status', function() {
      if (
        session.status === 'Disconnected' ||
        session.status === 'VoiceMail'
      ) {
        $modal.modal('hide');
        return;
      }
      if (!hasAnswered && session.status === 'Answered') {
        hasAnswered = true;
        $modal.modal('hide');
        showCallControlModal(session);
      }
    })
  }

  function onLoginSuccess(server, appKey, appSecret) {
    localStorage.setItem('rcCallControlServer', server || '');
    localStorage.setItem('rcCallControlAppKey', appKey || '');
    localStorage.setItem('rcCallControlAppSecret', appSecret || '');
    initCallControl();
    initWebPhone({ appKey }).then(function () {
      showCallPage();
    }); 
  }

  function show3LeggedLogin(server, appKey, appSecret) {
    rcsdk = new RingCentral.SDK({
      cachePrefix: 'rc-call',
      appKey: appKey,
      appSecret: appSecret,
      server: server,
      redirectUri: redirectUri
    });

    platform = rcsdk.platform(server, appKey, appSecret);

    var loginUrl = platform.loginUrl({ implicit: !appSecret });
    platform.loggedIn().then(function(isLogin) {
      loggedIn = isLogin;
      if (loggedIn) {
        onLoginSuccess(server, appKey, appSecret);
        return;
      }
      platform.loginWindow({ url: loginUrl })
        .then(function (loginOptions){
          return platform.login(loginOptions);
        })
        .then(function() {
          onLoginSuccess(server, appKey, appSecret);
        })
        .catch(function(e) {
          console.error(e.stack || e);
        });
    });
  };

  function init() {
    var $authForm = cloneTemplate($authFlowTemplate);
    var $server = $authForm.find('input[name=server]').eq(0);
    var $appKey = $authForm.find('input[name=appKey]').eq(0);
    var $appSecret = $authForm.find('input[name=appSecret]').eq(0);
    var $redirectUri = $authForm.find('input[name=redirectUri]').eq(0);
    $server.val(localStorage.getItem('rcCallControlServer') || RingCentral.SDK.server.sandbox);
    $appKey.val(localStorage.getItem('rcCallControlAppKey') || '');
    $appSecret.val(localStorage.getItem('rcCallControlAppSecret') || '');
    $redirectUri.val(redirectUri);

    $authForm.on('submit', function(e) {
      e.preventDefault();
      e.stopPropagation();
      show3LeggedLogin($server.val(), $appKey.val(), $appSecret.val());
    });

    $app.empty().append($authForm);
  }

  init();
});
