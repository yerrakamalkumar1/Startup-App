(function() {
  const user = getCurrentUser && getCurrentUser();
  if (!user) {
    document.querySelector('.edit-profile-page').innerHTML = '<div class="empty-state"><h3>Sign in required</h3><p>Please sign in to edit your profile.</p><a class="empty-state-cta" href="/auth-portal">Sign In</a></div>';
    return;
  }

  const profile = user;
  document.getElementById('editName').value = profile.name || '';
  document.getElementById('editHeadline').value = profile.title || '';
  document.getElementById('editBio').value = profile.bio || '';
  document.getElementById('editRole').value = profile.role || 'freelancer';
  document.getElementById('editCompany').value = profile.companyName || profile.company || '';
  document.getElementById('editLocation').value = [profile.city, profile.state].filter(Boolean).join(', ');
  document.getElementById('editSkills').value = (profile.skills || []).join(', ');
  document.getElementById('editLinkedin').value = profile.linkedinUrl || '';
  document.getElementById('editWebsite').value = profile.website || '';
  if (profile.avatarPhoto) {
    document.getElementById('profilePreview').src = typeof profile.avatarPhoto === 'object' ? profile.avatarPhoto.dataUrl : profile.avatarPhoto;
  }
  if (profile.coverPhoto) {
    document.getElementById('coverPreview').src = typeof profile.coverPhoto === 'object' ? profile.coverPhoto.dataUrl : profile.coverPhoto;
  }

  document.getElementById('coverInput').addEventListener('change', function() {
    handlePhotoUpload(this.files[0], 'cover', 'coverPreview');
  });

  document.getElementById('profileInput').addEventListener('change', function() {
    handlePhotoUpload(this.files[0], 'profile', 'profilePreview');
  });

  async function handlePhotoUpload(file, type, previewId) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
      const dataUrl = e.target.result;
      document.getElementById(previewId).src = dataUrl;
      try {
        const res = await fetch('/api/profile/photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: dataUrl, type: type })
        });
        const data = await res.json();
        if (data.success && ConnectHub && ConnectHub.showToast) {
          ConnectHub.showToast({ type: 'success', message: (type === 'cover' ? 'Cover' : 'Profile') + ' photo updated!' });
        }
      } catch (e) {
        if (ConnectHub && ConnectHub.showToast) ConnectHub.showToast({ type: 'error', message: 'Upload failed' });
      }
    };
    reader.readAsDataURL(file);
  }

  document.getElementById('editProfileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const skills = document.getElementById('editSkills').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    const locParts = document.getElementById('editLocation').value.split(',').map(function(s) { return s.trim(); });
    const payload = {
      name: document.getElementById('editName').value,
      title: document.getElementById('editHeadline').value,
      bio: document.getElementById('editBio').value,
      role: document.getElementById('editRole').value,
      companyName: document.getElementById('editCompany').value,
      city: locParts[0] || '',
      state: locParts[1] || '',
      skills: skills,
      linkedinUrl: document.getElementById('editLinkedin').value,
      website: document.getElementById('editWebsite').value
    };

    const btn = this.querySelector('.btn-save-profile');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (ConnectHub && ConnectHub.showToast) ConnectHub.showToast({ type: 'success', message: 'Profile updated!' });
        if (typeof updateCurrentProfile === 'function') updateCurrentProfile(payload);
        setTimeout(function() { window.location.href = '/profile/' + encodeURIComponent(profile.email || profile.name); }, 800);
      } else {
        throw new Error(data.message || 'Failed to save');
      }
    } catch (e) {
      if (ConnectHub && ConnectHub.showToast) ConnectHub.showToast({ type: 'error', message: e.message });
      btn.textContent = 'Save Changes';
      btn.disabled = false;
    }
  });
})();
