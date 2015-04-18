"""
Tests for the OPAL API
"""
from django.contrib.auth.models import User
from django.test import TestCase
from mock import patch, MagicMock

from opal import models
from opal.tests.models import Colour

from opal.views import api

class OPALRouterTestCase(TestCase):
    def test_default_base_name(self):
        class ViewSet:
            base_name = 'the name'
        self.assertEqual(api.OPALRouter().get_default_base_name(ViewSet), 'the name')


class FlowTestCase(TestCase):

    @patch('opal.views.api.app')
    def test_list(self, app):
        app.flows.return_value = [{}]
        self.assertEqual([{}], api.FlowViewSet().list(None).data)
        
        
class RecordTestCase(TestCase):
    
    @patch('opal.views.api.schemas')
    def test_records(self, schemas):
        schemas.list_records.return_value = [{}]
        self.assertEqual([{}], api.RecordViewSet().list(None).data)


class ListSchemaTestCase(TestCase):
    
    @patch('opal.views.api.schemas')
    def test_records(self, schemas):
        schemas.list_schemas.return_value = [{}]
        self.assertEqual([{}], api.ListSchemaViewSet().list(None).data)


class ExtractSchemaTestCase(TestCase):
    
    @patch('opal.views.api.schemas')
    def test_records(self, schemas):
        schemas.extract_schema.return_value = [{}]
        self.assertEqual([{}], api.ExtractSchemaViewSet().list(None).data)


class SubrecordTestCase(TestCase):
    
    def setUp(self):
        self.patient = models.Patient.objects.create()
        self.episode = models.Episode.objects.create(patient=self.patient)
        self.user    = User.objects.create(username='testuser')
        
        class OurViewSet(api.SubrecordViewSet):
            base_name = 'colour'
            model     = Colour

        self.model   = Colour
        self.viewset = OurViewSet

    def test_retrieve(self):
        with patch.object(self.model.objects, 'get') as mockget:
            mockget.return_value.to_dict.return_value = 'serialized colour'

            response = self.viewset().retrieve(MagicMock(name='request'), pk=1)
            self.assertEqual('serialized colour', response.data)

    def test_create(self):
        mock_request = MagicMock(name='mock request')
        mock_request.user = self.user
        mock_request.data = {'name': 'blue', 'episode_id': self.episode.pk}
        response = self.viewset().create(mock_request)
        self.assertEqual('blue', response.data['colour'][0]['name'])
        self.assertEqual(self.episode.pk, response.data['id'])

    @patch('opal.views.api.glossolalia.change')
    def test_create_pings_integration(self, change):
        mock_request = MagicMock(name='mock request')
        mock_request.data = {'name': 'blue', 'episode_id': self.episode.pk}
        mock_request.user = self.user
        response = self.viewset().create(mock_request)
        self.assertEqual(1, change.call_count)

    def test_create_nonexistant_episode(self):
        mock_request = MagicMock(name='mock request')
        mock_request.data = {'name': 'blue', 'episode_id': 56785}
        mock_request.user = self.user
        response = self.viewset().create(mock_request)
        self.assertEqual(400, response.status_code)

    def test_create_unexpected_field(self):
        mock_request = MagicMock(name='mock request')
        mock_request.data = {'name': 'blue', 'hue': 'enabled', 'episode_id': self.episode.pk}
        mock_request.user = self.user
        response = self.viewset().create(mock_request)
        self.assertEqual(400, response.status_code)

    def test_update(self):
        colour = Colour.objects.create(name='blue', episode=self.episode)
        mock_request = MagicMock(name='mock request')
        mock_request.data = {
            'name'             : 'green',
            'episode_id'       : self.episode.pk,
            'id'               : colour.pk,
            'consistency_token': colour.consistency_token
        }
        mock_request.user = self.user
        response = self.viewset().update(mock_request, pk=colour.pk)
        self.assertEqual(202, response.status_code)
        self.assertEqual('green', response.data['name'])

    @patch('opal.views.api.glossolalia.change')
    def test_update_pings_integration(self, change):
        colour = Colour.objects.create(name='blue', episode=self.episode)
        mock_request = MagicMock(name='mock request')
        mock_request.data = {
            'name'             : 'green',
            'episode_id'       : self.episode.pk,
            'id'               : colour.pk,
            'consistency_token': colour.consistency_token
        }
        mock_request.user = self.user
        response = self.viewset().update(mock_request, pk=colour.pk)
        self.assertEqual(202, response.status_code)
        self.assertEqual(1, change.call_count)
    
    def test_update_item_changed(self):
        colour = Colour.objects.create(
            name='blue',
            episode=self.episode,
            consistency_token='frist'
        )
        mock_request = MagicMock(name='mock request')
        mock_request.data = {
            'name'             : 'green',
            'episode_id'       : self.episode.pk,
            'id'               : colour.pk,
            'consistency_token': 'wat'
        }
        mock_request.user = self.user
        response = self.viewset().update(mock_request, pk=colour.pk)
        self.assertEqual(409, response.status_code)

    def test_update_nonexistent(self):
        response = self.viewset().update(MagicMock(), pk=67757)
        self.assertEqual(404, response.status_code)

    def test_update_unexpected_field(self):
        colour = Colour.objects.create(name='blue', episode=self.episode)
        mock_request = MagicMock(name='mock request')
        mock_request.data = {
            'name'             : 'green',
            'hue'              : 'sea',
            'episode_id'       : self.episode.pk,
            'id'               : colour.pk,
            'consistency_token': colour.consistency_token
        }
        mock_request.user = self.user
        response = self.viewset().update(mock_request, pk=colour.pk)
        self.assertEqual(400, response.status_code)

    def test_delete(self):
        colour = Colour.objects.create(episode=self.episode)
        mock_request = MagicMock(name='mock request')
        mock_request.user = self.user
        response = self.viewset().destroy(mock_request, pk=colour.pk)
        self.assertEqual(202, response.status_code)
        with self.assertRaises(Colour.DoesNotExist):
            c2 = Colour.objects.get(pk=colour.pk)

    def test_delete_nonexistent(self):
        response = self.viewset().destroy(MagicMock(name='request'), pk=567)
        self.assertEqual(404, response.status_code)

    @patch('opal.views.api.glossolalia.change')
    def test_delete_pings_integration(self, change):
        colour = Colour.objects.create(episode=self.episode)
        mock_request = MagicMock(name='mock request')
        mock_request.user = self.user
        response = self.viewset().destroy(mock_request, pk=colour.pk)
        self.assertEqual(202, response.status_code)
        self.assertEqual(1, change.call_count)


class UserProfileTestCase(TestCase):

    def setUp(self):
        self.user = User.objects.create(username='testuser')
        models.UserProfile.objects.create(user=self.user)
        self.mock_request = MagicMock(name='request')
        self.mock_request.user = self.user
        
    def test_user_profile(self):
        with patch.object(self.user, 'is_authenticated', return_value=True):
            response = api.UserProfileViewSet().list(self.mock_request)
            expected = {
                'readonly'   :  False,
                'can_extract': False,
                'filters'    : [],
                'roles'      : {'default': []}
            }
            self.assertEqual(expected, response.data)

    def test_user_profile_readonly(self):
        with patch.object(self.user, 'is_authenticated', return_value=True):
            profile = self.user.get_profile()
            profile.readonly = True
            profile.save()
            response = api.UserProfileViewSet().list(self.mock_request)
            self.assertEqual(True, response.data['readonly'])

    def test_user_profile_not_logged_in(self):
        mock_request = MagicMock(name='request')
        mock_request.user.is_authenticated.return_value = False
        response = api.UserProfileViewSet().list(mock_request)
        self.assertEqual(401, response.status_code)
        
